import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../core/discovery.dart';
import '../core/protocol.dart';
import '../core/session.dart';
import '../strings.dart';
import 'chat_screen.dart';
import 'device.dart';
import 'scanner_page.dart';

class SendScreen extends StatefulWidget {
  const SendScreen({super.key});

  @override
  State<SendScreen> createState() => _SendScreenState();
}

class _SendScreenState extends State<SendScreen> {
  final _session = Session();
  final _discovery = LanDiscovery();
  final _code = TextEditingController();
  final _address = TextEditingController();
  QrPayload? _scanned;
  String? _localError;
  var _busy = false;

  @override
  void initState() {
    super.initState();
    _session.addListener(_onSession);
  }

  @override
  void dispose() {
    _session.removeListener(_onSession);
    _code.dispose();
    _address.dispose();
    final session = _session;
    unawaited(session.end().whenComplete(session.dispose));
    unawaited(_discovery.stop());
    super.dispose();
  }

  void _onSession() {
    if (mounted) setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    final session = _session;
    return PopScope(
      onPopInvokedWithResult: (didPop, _) {
        if (didPop) unawaited(session.end());
      },
      child: Scaffold(
        appBar: AppBar(
          title: const Text(S.enterCode),
          actions: [
            if (session.phase == SessionPhase.active)
              TextButton(onPressed: _end, child: const Text(S.endSession)),
          ],
        ),
        body: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 480),
            child: _body(session),
          ),
        ),
      ),
    );
  }

  Widget _body(Session session) {
    final failure = session.error;
    if (session.phase == SessionPhase.closed && failure != null) {
      return Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(S.error(failure), textAlign: TextAlign.center),
            const SizedBox(height: 16),
            FilledButton(
              onPressed: () => unawaited(session.reset()),
              child: const Text(S.tryAgain),
            ),
          ],
        ),
      );
    }
    if (session.phase == SessionPhase.active) {
      return ChatScreen(session: session);
    }
    if (session.phase == SessionPhase.pending || session.phase == SessionPhase.waiting) {
      return Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(
              session.phase == SessionPhase.pending ? S.waitingApproval : S.lookingUp,
              textAlign: TextAlign.center,
            ),
            if (session.verificationCode != null) ...[
              const SizedBox(height: 16),
              Text(S.verificationLabel, style: Theme.of(context).textTheme.labelLarge),
              Text(session.verificationCode!, style: Theme.of(context).textTheme.headlineMedium),
            ],
          ],
        ),
      );
    }
    return ListView(
      padding: const EdgeInsets.all(24),
      children: [
        TextField(
          controller: _code,
          textCapitalization: TextCapitalization.characters,
          maxLength: 6,
          inputFormatters: [
            FilteringTextInputFormatter.allow(
              RegExp('[ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjklmnpqrstuvwxyz23456789]'),
            ),
          ],
          decoration: const InputDecoration(labelText: S.codeLabel, counterText: ''),
        ),
        const SizedBox(height: 12),
        TextField(
          controller: _address,
          decoration: const InputDecoration(labelText: S.addressLabel, hintText: S.addressHint),
        ),
        if (_localError != null) ...[
          const SizedBox(height: 12),
          Text(_localError!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
        ],
        const SizedBox(height: 16),
        FilledButton(
          onPressed: _busy ? null : _connect,
          child: Text(_busy ? S.lookingUp : S.connect),
        ),
        if (canScanQr) ...[
          const SizedBox(height: 12),
          OutlinedButton(onPressed: _busy ? null : _scan, child: const Text(S.scanQr)),
        ],
      ],
    );
  }

  Future<void> _scan() async {
    final payload = await Navigator.of(context).push<QrPayload>(
      MaterialPageRoute(builder: (_) => const ScannerPage()),
    );
    if (payload == null || !mounted) return;
    _code.text = payload.code;
    _address.text = payload.address;
    _scanned = payload;
    await _start(payload.code, payload.address, payload.publicKey);
  }

  Future<void> _connect() async {
    final code = _code.text.trim().toUpperCase();
    if (!isSessionCode(code)) {
      setState(() => _localError = S.invalidCode);
      return;
    }
    var address = _address.text.trim();
    final scanned = _scanned;
    final pinned = scanned != null && scanned.code == code && scanned.address == address
        ? scanned.publicKey
        : null;
    if (address.isEmpty) {
      setState(() {
        _busy = true;
        _localError = null;
      });
      address = await _discovery.find(code) ?? '';
      if (!mounted) return;
      setState(() => _busy = false);
      if (address.isEmpty) {
        setState(() => _localError = S.notFound);
        return;
      }
    }
    await _start(code, address, pinned);
  }

  Future<void> _start(String code, String address, String? pinnedKey) async {
    setState(() => _localError = null);
    await _session.startSender(
      code: code,
      address: address,
      deviceName: deviceName(),
      pinnedPublicKey: pinnedKey,
    );
  }

  Future<void> _end() async {
    final end = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text(S.endTitle),
        content: const Text(S.endBody),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text(S.cancel)),
          FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text(S.end)),
        ],
      ),
    );
    if (end == true && mounted) Navigator.pop(context);
  }
}
