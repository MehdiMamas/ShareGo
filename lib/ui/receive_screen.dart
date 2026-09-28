import 'dart:async';

import 'package:flutter/material.dart';
import 'package:qr_flutter/qr_flutter.dart';

import '../core/discovery.dart';
import '../core/session.dart';
import '../strings.dart';
import 'chat_screen.dart';
import 'device.dart';

class ReceiveScreen extends StatefulWidget {
  const ReceiveScreen({super.key});

  @override
  State<ReceiveScreen> createState() => _ReceiveScreenState();
}

class _ReceiveScreenState extends State<ReceiveScreen> {
  final _session = Session();
  final _discovery = LanDiscovery();
  String? _advertisedCode;
  var _asking = false;

  @override
  void initState() {
    super.initState();
    _session.addListener(_onSession);
    unawaited(_session.startReceiver(deviceName: deviceName()));
  }

  @override
  void dispose() {
    _session.removeListener(_onSession);
    final session = _session;
    unawaited(session.end().whenComplete(session.dispose));
    unawaited(_discovery.stop());
    super.dispose();
  }

  void _onSession() {
    if (!mounted) return;
    setState(() {});
    final code = _session.code;
    final port = _session.port;
    if (_session.phase == SessionPhase.waiting && code != null && port != null && code != _advertisedCode) {
      _advertisedCode = code;
      unawaited(
        _discovery.advertise(code: code, port: port).then(
          (_) {},
          onError: (Object _, StackTrace _) {},
        ),
      );
    }
    if (_session.phase == SessionPhase.pending && !_asking) {
      _asking = true;
      unawaited(_ask());
    }
  }

  Future<void> _ask() async {
    final accepted = await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (context) => AlertDialog(
        title: const Text(S.approveTitle),
        content: Text(S.approveBody(_session.peerName ?? S.unknownDevice, _session.verificationCode ?? '')),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text(S.reject)),
          FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text(S.approve)),
        ],
      ),
    );
    if (!mounted) return;
    if (accepted == true) {
      await _session.approve();
    } else if (accepted == false) {
      await _session.reject();
      if (mounted) Navigator.pop(context);
    }
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
          title: const Text(S.appName),
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
            FilledButton(onPressed: () => Navigator.pop(context), child: const Text(S.back)),
          ],
        ),
      );
    }
    if (session.phase == SessionPhase.active) {
      return ChatScreen(session: session);
    }
    final payload = session.qrPayload;
    final seconds = session.bootstrapSecondsLeft;
    return ListView(
      padding: const EdgeInsets.all(24),
      children: [
        if (payload != null)
          Center(child: QrImageView(data: payload, size: 220))
        else
          const Text(S.noAddress),
        const SizedBox(height: 16),
        Text(session.code ?? '', style: Theme.of(context).textTheme.displaySmall, textAlign: TextAlign.center),
        const SizedBox(height: 8),
        if (session.address != null) Text('${S.addressLabel}: ${session.address}', textAlign: TextAlign.center),
        if (seconds != null) Text(S.countdown(seconds), textAlign: TextAlign.center),
        const SizedBox(height: 16),
        const Text(S.waitingForPeer, textAlign: TextAlign.center),
        if (session.phase == SessionPhase.pending) ...[
          const SizedBox(height: 16),
          Text(S.verificationLabel, textAlign: TextAlign.center, style: Theme.of(context).textTheme.labelLarge),
          Text(session.verificationCode ?? '', textAlign: TextAlign.center, style: Theme.of(context).textTheme.headlineMedium),
        ],
      ],
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
