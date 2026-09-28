import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:math';

import 'package:flutter/foundation.dart';

import '../config.dart';
import 'crypto.dart';
import 'frames.dart';
import 'protocol.dart';

enum SessionPhase { idle, waiting, pending, active, closed }

enum SessionError {
  connectionFailed,
  codeExpired,
  keyMismatch,
  rejected,
  timedOut,
  peerClosed,
  invalidMessage,
}

enum _Role { receiver, sender }

class ChatMessage {
  const ChatMessage({
    required this.seq,
    required this.text,
    required this.outgoing,
    this.delivered = false,
  });

  final int seq;
  final String text;
  final bool outgoing;
  final bool delivered;

  ChatMessage copyWith({bool? delivered}) => ChatMessage(
        seq: seq,
        text: text,
        outgoing: outgoing,
        delivered: delivered ?? this.delivered,
      );
}

class ConnectionClosed implements Exception {
  const ConnectionClosed();
}

class _FrameQueue {
  final _frames = <Uint8List>[];
  final _waiters = <Completer<Uint8List>>[];
  var _closed = false;

  void add(Uint8List frame) {
    if (_closed) return;
    if (_waiters.isNotEmpty) {
      _waiters.removeAt(0).complete(frame);
    } else {
      _frames.add(frame);
    }
  }

  Future<Uint8List> get next {
    if (_frames.isNotEmpty) return Future.value(_frames.removeAt(0));
    if (_closed) return Future.error(const ConnectionClosed());
    final waiter = Completer<Uint8List>();
    _waiters.add(waiter);
    return waiter.future;
  }

  void close() {
    if (_closed) return;
    _closed = true;
    for (final waiter in _waiters) {
      if (!waiter.isCompleted) waiter.completeError(const ConnectionClosed());
    }
    _waiters.clear();
  }
}

class Session extends ChangeNotifier {
  Session({
    Duration? bootstrapTtl,
    Duration? sessionTtl,
    Duration? approvalTimeout,
    Duration? connectTimeout,
    Random? random,
  })  : bootstrapTtl = bootstrapTtl ?? AppConfig.bootstrapTtl,
        sessionTtl = sessionTtl ?? AppConfig.sessionTtl,
        approvalTimeout = approvalTimeout ?? AppConfig.approvalTimeout,
        connectTimeout = connectTimeout ?? AppConfig.connectTimeout,
        _random = random ?? Random.secure();

  final Duration bootstrapTtl;
  final Duration sessionTtl;
  final Duration approvalTimeout;
  final Duration connectTimeout;
  final Random _random;

  SessionPhase phase = SessionPhase.idle;
  SessionError? error;
  String? code;
  String? qrPayload;
  String? peerName;
  String? verificationCode;
  int? bootstrapSecondsLeft;
  int? port;

  final List<ChatMessage> _messages = [];
  List<ChatMessage> get messages => List.unmodifiable(_messages);

  _Role? _role;
  Identity? _identity;
  SessionKeys? _keys;
  ServerSocket? _server;
  StreamSubscription<Socket>? _serverSub;
  Socket? _socket;
  StreamSubscription<Uint8List>? _socketSub;
  FrameReader _reader = FrameReader();
  _FrameQueue _queue = _FrameQueue();
  Future<void> _writes = Future<void>.value();
  Timer? _bootstrapTimer;
  Timer? _countdownTimer;
  Timer? _approvalTimer;
  Timer? _ttlTimer;
  DateTime? _bootstrapDeadline;
  String? _host;
  var _sendSeq = 1;
  var _recvSeq = 1;
  var _closing = false;
  var _handedOff = false;
  var _rotating = false;

  String? get address {
    final host = _host;
    final bound = port;
    if (host == null || bound == null) return null;
    return '$host:$bound';
  }

  String? get publicKey {
    final identity = _identity;
    if (identity == null) return null;
    return base64Encode(identity.publicKey);
  }

  Future<void> startReceiver({
    required String deviceName,
    String? advertiseHost,
  }) async {
    if (phase != SessionPhase.idle) return;
    _role = _Role.receiver;
    phase = SessionPhase.waiting;
    notifyListeners();
    try {
      final server = await _bind();
      _server = server;
      port = server.port;
      _host = advertiseHost ?? await localIpv4();
      _serverSub = server.listen(
        (socket) => unawaited(_onSocket(socket)),
        onError: (Object _) {
          if (!_closing && phase == SessionPhase.waiting) {
            unawaited(_finish(sendClose: false, error: SessionError.connectionFailed));
          }
        },
      );
      await _rotate();
      _bootstrapTimer = Timer.periodic(bootstrapTtl, (_) => unawaited(_rotate()));
    } catch (_) {
      await _finish(sendClose: false, error: SessionError.connectionFailed);
    }
  }

  Future<void> startSender({
    required String code,
    required String address,
    required String deviceName,
    String? pinnedPublicKey,
  }) async {
    if (phase != SessionPhase.idle) return;
    final normalized = code.trim().toUpperCase();
    final target = parseAddress(address);
    if (!isSessionCode(normalized) || target == null) {
      await _finish(sendClose: false, error: SessionError.invalidMessage);
      return;
    }
    _role = _Role.sender;
    phase = SessionPhase.waiting;
    notifyListeners();
    try {
      _identity = await Identity.generate();
      final socket = await Socket.connect(
        target.$1,
        target.$2,
        timeout: connectTimeout,
      );
      _attach(socket);
      final hello = helloMessage(
        code: normalized,
        publicKey: base64Encode(_identity!.publicKey),
        deviceName: sanitizeDeviceName(deviceName),
      );
      final helloBytes = await _sendPlain(hello);
      final frame = await _queue.next.timeout(connectTimeout);
      final message = decodeMap(frame);
      if (message['type'] == 'DENY') {
        await _finish(sendClose: false, error: SessionError.codeExpired);
        return;
      }
      if (message['v'] != AppConfig.protocolVersion || message['type'] != 'WELCOME') {
        await _finish(sendClose: false, error: SessionError.invalidMessage);
        return;
      }
      final remoteKey = decodePublicKey(message['pk']);
      if (remoteKey == null) {
        await _finish(sendClose: false, error: SessionError.invalidMessage);
        return;
      }
      if (pinnedPublicKey != null) {
        final pinned = decodePublicKey(pinnedPublicKey);
        if (pinned == null || !constantTimeEquals(pinned, remoteKey)) {
          await _finish(sendClose: false, error: SessionError.keyMismatch);
          return;
        }
      }
      _keys = await deriveSessionKeys(
        local: _identity!.keys,
        remotePublicKey: remoteKey,
        helloBytes: helloBytes,
        welcomeBytes: frame,
        iAmSender: true,
      );
      _enterPending();
      unawaited(_readLoop());
    } on TimeoutException {
      await _finish(sendClose: false, error: SessionError.timedOut);
    } on ConnectionClosed {
      await _finish(sendClose: false, error: SessionError.connectionFailed);
    } catch (_) {
      await _finish(sendClose: false, error: SessionError.connectionFailed);
    }
  }

  Future<void> approve() async {
    if (phase != SessionPhase.pending || _role != _Role.receiver || _keys == null) {
      return;
    }
    try {
      await _sendEncrypted({'type': 'ACCEPT'});
      _becomeActive();
    } catch (_) {
      await _finish(sendClose: false, error: SessionError.connectionFailed);
    }
  }

  Future<void> reject() async {
    if (phase != SessionPhase.pending || _role != _Role.receiver) return;
    try {
      await _sendEncrypted({'type': 'REJECT', 'reason': 'rejected'});
    } catch (_) {}
    await _finish(sendClose: false, error: SessionError.rejected);
  }

  Future<bool> sendText(String text) async {
    if (phase != SessionPhase.active || _keys == null) return false;
    if (text.isEmpty || text.length > AppConfig.maxTextLength) return false;
    try {
      final seq = await _sendEncrypted({'type': 'DATA', 'text': text});
      _messages.add(ChatMessage(seq: seq, text: text, outgoing: true));
      notifyListeners();
      return true;
    } catch (_) {
      await _finish(sendClose: false, error: SessionError.connectionFailed);
      return false;
    }
  }

  Future<void> end() async {
    if (_closing || phase == SessionPhase.idle || phase == SessionPhase.closed) {
      return;
    }
    final sendClose = _keys != null &&
        (phase == SessionPhase.active || phase == SessionPhase.pending);
    await _finish(sendClose: sendClose, error: null);
  }

  /// after [end], the same object can listen again. used by the send screen.
  Future<void> reset() async {
    await end();
    _closing = false;
    _handedOff = false;
    _rotating = false;
    _sendSeq = 1;
    _recvSeq = 1;
    _role = null;
    _messages.clear();
    code = null;
    qrPayload = null;
    peerName = null;
    verificationCode = null;
    bootstrapSecondsLeft = null;
    port = null;
    _host = null;
    error = null;
    phase = SessionPhase.idle;
    _writes = Future<void>.value();
    _reader = FrameReader();
    _queue = _FrameQueue();
    notifyListeners();
  }

  Future<ServerSocket> _bind() async {
    try {
      return await ServerSocket.bind(InternetAddress.anyIPv4, AppConfig.defaultPort);
    } on SocketException {
      return ServerSocket.bind(InternetAddress.anyIPv4, 0);
    }
  }

  Future<void> _rotate() async {
    if (_rotating || _closing || phase != SessionPhase.waiting || _handedOff) return;
    _rotating = true;
    try {
      final next = await Identity.generate();
      final nextCode = generateCode(_random);
      if (_closing || _handedOff || phase != SessionPhase.waiting) {
        next.wipe();
        return;
      }
      _identity?.wipe();
      _identity = next;
      code = nextCode;
      final host = address;
      final key = publicKey;
      qrPayload = host == null || key == null
          ? null
          : encodeQr(code: nextCode, address: host, publicKey: key);
      _restartCountdown();
      notifyListeners();
    } finally {
      _rotating = false;
    }
  }

  void _restartCountdown() {
    _countdownTimer?.cancel();
    _bootstrapDeadline = DateTime.now().add(bootstrapTtl);
    bootstrapSecondsLeft = bootstrapTtl.inSeconds;
    _countdownTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      final deadline = _bootstrapDeadline;
      if (deadline == null || phase != SessionPhase.waiting) return;
      final left = deadline.difference(DateTime.now()).inSeconds;
      bootstrapSecondsLeft = left < 0 ? 0 : left;
      notifyListeners();
    });
  }

  void _pauseBootstrap() {
    _bootstrapTimer?.cancel();
    _countdownTimer?.cancel();
    bootstrapSecondsLeft = null;
    notifyListeners();
  }

  void _resumeBootstrap() {
    if (phase != SessionPhase.waiting || _handedOff) return;
    _restartCountdown();
    _bootstrapTimer = Timer.periodic(bootstrapTtl, (_) => unawaited(_rotate()));
    notifyListeners();
  }

  Future<void> _onSocket(Socket socket) async {
    if (_handedOff || phase != SessionPhase.waiting) {
      socket.destroy();
      return;
    }
    _handedOff = true;
    _pauseBootstrap();
    _attach(socket);
    try {
      final frame = await _queue.next.timeout(connectTimeout);
      final message = decodeMap(frame);
      final remoteKey = decodePublicKey(message['pk']);
      final matches = message['v'] == AppConfig.protocolVersion &&
          message['type'] == 'HELLO' &&
          message['code'] == code &&
          remoteKey != null;
      if (!matches) {
        if (message['type'] == 'HELLO') {
          await _sendPlain(denyMessage('code expired'));
        }
        await _detach();
        _handedOff = false;
        _resumeBootstrap();
        return;
      }
      final welcomeBytes = await _sendPlain(welcomeMessage(base64Encode(_identity!.publicKey)));
      _keys = await deriveSessionKeys(
        local: _identity!.keys,
        remotePublicKey: remoteKey,
        helloBytes: frame,
        welcomeBytes: welcomeBytes,
        iAmSender: false,
      );
      peerName = sanitizeDeviceName(message['deviceName']);
      await _serverSub?.cancel();
      _serverSub = null;
      await _server?.close();
      _server = null;
      _enterPending();
      unawaited(_readLoop());
    } on TimeoutException {
      await _detach();
      _handedOff = false;
      if (phase == SessionPhase.waiting) _resumeBootstrap();
    } on ConnectionClosed {
      await _detach();
      _handedOff = false;
      if (phase == SessionPhase.waiting) _resumeBootstrap();
    } catch (_) {
      if (_keys != null) {
        await _finish(sendClose: false, error: SessionError.invalidMessage);
        return;
      }
      await _detach();
      _handedOff = false;
      if (phase == SessionPhase.waiting) _resumeBootstrap();
    }
  }

  void _attach(Socket socket) {
    _socket = socket;
    _reader = FrameReader();
    _queue = _FrameQueue();
    _writes = Future<void>.value();
    _socketSub = socket.listen(
      (data) {
        try {
          for (final frame in _reader.add(data)) {
            _queue.add(frame);
          }
        } on FrameException {
          unawaited(_finish(sendClose: false, error: SessionError.invalidMessage));
        }
      },
      onError: (Object _) {
        _queue.close();
        if (!_closing) {
          unawaited(_finish(sendClose: false, error: SessionError.connectionFailed));
        }
      },
      onDone: _queue.close,
    );
  }

  Future<void> _detach() async {
    final sub = _socketSub;
    _socketSub = null;
    _queue.close();
    await sub?.cancel();
    _socket?.destroy();
    _socket = null;
    _writes = Future<void>.value();
    _reader = FrameReader();
    _queue = _FrameQueue();
  }

  void _enterPending() {
    _approvalTimer?.cancel();
    phase = SessionPhase.pending;
    verificationCode = _keys?.verificationCode;
    _approvalTimer = Timer(approvalTimeout, () {
      unawaited(_finish(sendClose: false, error: SessionError.timedOut));
    });
    notifyListeners();
  }

  void _becomeActive() {
    _approvalTimer?.cancel();
    phase = SessionPhase.active;
    _ttlTimer?.cancel();
    _ttlTimer = Timer(sessionTtl, () {
      unawaited(_finish(sendClose: true, error: SessionError.timedOut));
    });
    notifyListeners();
  }

  Future<void> _readLoop() async {
    try {
      while (!_closing) {
        final frame = await _queue.next;
        if (_closing) return;
        await _onEncrypted(frame);
      }
    } on ConnectionClosed {
      if (!_closing) {
        await _finish(sendClose: false, error: SessionError.peerClosed);
      }
    } catch (_) {
      if (!_closing) {
        await _finish(sendClose: false, error: SessionError.invalidMessage);
      }
    }
  }

  Future<void> _onEncrypted(Uint8List frame) async {
    final message = decodeMap(frame);
    final seq = message['seq'];
    final nonce = message['nonce'];
    final ciphertext = message['ct'];
    final keys = _keys;
    if (keys == null ||
        message['v'] != AppConfig.protocolVersion ||
        message['type'] != 'ENC' ||
        seq is! int ||
        nonce is! String ||
        ciphertext is! String ||
        seq != _recvSeq) {
      await _finish(sendClose: false, error: SessionError.invalidMessage);
      return;
    }
    final List<int> plain;
    try {
      plain = await open(
        secretKey: keys.receive,
        nonce: base64Decode(nonce),
        cipherAndMac: base64Decode(ciphertext),
        seq: seq,
      );
    } catch (_) {
      await _finish(sendClose: false, error: SessionError.invalidMessage);
      return;
    }
    _recvSeq++;
    await _onInner(decodeMap(plain), seq);
  }

  Future<void> _onInner(Map<String, dynamic> message, int seq) async {
    final type = message['type'];
    if (type == 'ACCEPT') {
      if (_role != _Role.sender || phase != SessionPhase.pending) {
        await _finish(sendClose: false, error: SessionError.invalidMessage);
        return;
      }
      _becomeActive();
      return;
    }
    if (type == 'REJECT') {
      await _finish(sendClose: false, error: SessionError.rejected);
      return;
    }
    if (type == 'DATA') {
      if (phase != SessionPhase.active) {
        await _finish(sendClose: false, error: SessionError.invalidMessage);
        return;
      }
      final text = message['text'];
      if (text is! String || text.isEmpty || text.length > AppConfig.maxTextLength) {
        await _finish(sendClose: false, error: SessionError.invalidMessage);
        return;
      }
      _messages.add(ChatMessage(seq: seq, text: text, outgoing: false));
      notifyListeners();
      try {
        await _sendEncrypted({'type': 'ACK', 'ackSeq': seq});
      } catch (_) {
        await _finish(sendClose: false, error: SessionError.connectionFailed);
      }
      return;
    }
    if (type == 'ACK') {
      final ackSeq = message['ackSeq'];
      if (ackSeq is! int) return;
      for (var i = 0; i < _messages.length; i++) {
        final item = _messages[i];
        if (item.outgoing && item.seq == ackSeq && !item.delivered) {
          _messages[i] = item.copyWith(delivered: true);
        }
      }
      notifyListeners();
      return;
    }
    if (type == 'CLOSE') {
      await _finish(sendClose: false, error: SessionError.peerClosed);
      return;
    }
    await _finish(sendClose: false, error: SessionError.invalidMessage);
  }

  Future<Uint8List> _sendPlain(Map<String, Object> message) async {
    final body = Uint8List.fromList(utf8.encode(jsonEncode(message)));
    await _writeFrame(body);
    return body;
  }

  Future<int> _sendEncrypted(Map<String, Object> inner) async {
    final keys = _keys;
    if (keys == null) throw StateError('no keys');
    final seq = _sendSeq++;
    final sealed = await seal(
      secretKey: keys.send,
      plain: utf8.encode(jsonEncode(inner)),
      seq: seq,
    );
    await _writeFrame(
      Uint8List.fromList(
        utf8.encode(
          jsonEncode({
            'v': AppConfig.protocolVersion,
            'type': 'ENC',
            'seq': seq,
            'nonce': base64Encode(sealed.nonce),
            'ct': base64Encode(sealed.cipherAndMac),
          }),
        ),
      ),
    );
    return seq;
  }

  Future<void> _writeFrame(Uint8List body) {
    final pending = _writes.then((_) async {
      final socket = _socket;
      if (socket == null) throw const ConnectionClosed();
      final framed = encodeFrame(body);
      socket.add(framed);
      await socket.flush();
    });
    _writes = pending.then((_) {}, onError: (Object _, StackTrace _) {});
    return pending;
  }

  Future<void> _finish({required bool sendClose, SessionError? error}) async {
    if (_closing) return;
    _closing = true;
    _bootstrapTimer?.cancel();
    _countdownTimer?.cancel();
    _approvalTimer?.cancel();
    _ttlTimer?.cancel();
    if (sendClose && _keys != null && _socket != null) {
      try {
        await _sendEncrypted({'type': 'CLOSE'}).timeout(const Duration(seconds: 2));
      } catch (_) {}
    }
    _queue.close();
    await _socketSub?.cancel();
    _socketSub = null;
    _socket?.destroy();
    _socket = null;
    await _serverSub?.cancel();
    _serverSub = null;
    await _server?.close();
    _server = null;
    _identity?.wipe();
    _identity = null;
    _keys?.wipe();
    _keys = null;
    this.error = error;
    bootstrapSecondsLeft = null;
    phase = SessionPhase.closed;
    notifyListeners();
  }
}

/// a routable ipv4 address on a real interface, when the os has one.
Future<String?> localIpv4() async {
  final interfaces = await NetworkInterface.list(
    includeLinkLocal: false,
    type: InternetAddressType.IPv4,
  );
  final candidates = <(int, String)>[];
  for (final iface in interfaces) {
    final name = iface.name.toLowerCase();
    if (name.startsWith('lo') ||
        name.startsWith('utun') ||
        name.startsWith('awdl') ||
        name.startsWith('llw') ||
        name.startsWith('bridge')) {
      continue;
    }
    for (final addr in iface.addresses) {
      if (addr.isLoopback) continue;
      final ip = addr.address;
      final score = ip.startsWith('192.168.')
          ? 0
          : ip.startsWith('10.')
              ? 1
              : _is172Private(ip)
                  ? 2
                  : 3;
      candidates.add((score, ip));
    }
  }
  if (candidates.isEmpty) return null;
  candidates.sort((a, b) => a.$1.compareTo(b.$1));
  return candidates.first.$2;
}

bool _is172Private(String ip) {
  final parts = ip.split('.');
  if (parts.length != 4) return false;
  final second = int.tryParse(parts[1]);
  return parts[0] == '172' && second != null && second >= 16 && second <= 31;
}
