import 'dart:convert';
import 'dart:math';
import 'dart:typed_data';

import '../config.dart';

const sessionCodeAlphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

bool isSessionCode(String code) {
  if (code.length != AppConfig.codeLength) return false;
  for (final unit in code.codeUnits) {
    if (!sessionCodeAlphabet.contains(String.fromCharCode(unit))) return false;
  }
  return true;
}

String generateCode(Random random) {
  final chars = List<String>.generate(
    AppConfig.codeLength,
    (_) => sessionCodeAlphabet[random.nextInt(sessionCodeAlphabet.length)],
  );
  return chars.join();
}

/// accepts `host:port` or a bare host, which uses [AppConfig.defaultPort].
(String, int)? parseAddress(String input) {
  final trimmed = input.trim();
  if (trimmed.isEmpty) return null;
  final colon = trimmed.lastIndexOf(':');
  if (colon <= 0) return (trimmed, AppConfig.defaultPort);
  final host = trimmed.substring(0, colon);
  final port = int.tryParse(trimmed.substring(colon + 1));
  if (host.isEmpty || port == null || port <= 0 || port > 65535) return null;
  return (host, port);
}

Uint8List? decodePublicKey(Object? value) {
  if (value is! String || value.isEmpty) return null;
  try {
    final bytes = base64Decode(value);
    if (bytes.length != 32) return null;
    return Uint8List.fromList(bytes);
  } on FormatException {
    return null;
  }
}

String sanitizeDeviceName(Object? value) {
  if (value is! String) return 'Device';
  final cleaned = value.replaceAll(RegExp(r'[\u0000-\u001F\u007F]'), '').trim();
  if (cleaned.isEmpty) return 'Device';
  return cleaned.length <= 40 ? cleaned : cleaned.substring(0, 40);
}

Map<String, dynamic> decodeMap(List<int> bytes) {
  final decoded = jsonDecode(utf8.decode(bytes));
  if (decoded is! Map<String, dynamic>) {
    throw const FormatException('frame');
  }
  return decoded;
}

Map<String, Object> helloMessage({
  required String code,
  required String publicKey,
  required String deviceName,
}) =>
    {
      'v': AppConfig.protocolVersion,
      'type': 'HELLO',
      'code': code,
      'pk': publicKey,
      'deviceName': deviceName,
    };

Map<String, Object> welcomeMessage(String publicKey) => {
      'v': AppConfig.protocolVersion,
      'type': 'WELCOME',
      'pk': publicKey,
    };

Map<String, Object> denyMessage(String reason) => {
      'v': AppConfig.protocolVersion,
      'type': 'DENY',
      'reason': reason,
    };

class QrPayload {
  const QrPayload({
    required this.code,
    required this.address,
    required this.publicKey,
  });

  final String code;
  final String address;
  final String publicKey;

  static QrPayload? tryParse(String raw) {
    try {
      final decoded = jsonDecode(raw);
      if (decoded is! Map) return null;
      if (decoded['v'] != AppConfig.protocolVersion) return null;
      final code = decoded['code'];
      final address = decoded['addr'];
      final publicKey = decoded['pk'];
      if (code is! String || !isSessionCode(code)) return null;
      if (address is! String || parseAddress(address) == null) return null;
      if (publicKey is! String || decodePublicKey(publicKey) == null) return null;
      return QrPayload(code: code, address: address, publicKey: publicKey);
    } on FormatException {
      return null;
    }
  }
}

String encodeQr({
  required String code,
  required String address,
  required String publicKey,
}) {
  return jsonEncode({
    'v': AppConfig.protocolVersion,
    'code': code,
    'addr': address,
    'pk': publicKey,
  });
}
