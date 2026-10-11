import 'dart:async';
import 'dart:io';

import 'package:cryptography/cryptography.dart';
import 'package:cryptography_flutter/cryptography_flutter.dart';
import 'package:flutter/material.dart';
import 'package:sharego/core/session.dart';
import 'package:sharego/strings.dart';
import 'package:sharego/ui/chat_screen.dart';
import 'package:sharego/ui/home_screen.dart';
import 'package:sharego/ui/receive_screen.dart';
import 'package:sharego/ui/send_screen.dart';
import 'package:sharego/ui/theme.dart';

/// walks the app through each screen in the iOS simulator for the App Store
/// shots. tool/store_shots.sh takes a screenshot each time this writes
/// tmp/stage, then deletes the file to move on.
Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  Cryptography.instance = FlutterCryptography.defaultInstance;
  final receiver = Session();
  final sender = Session();
  await receiver.startReceiver(deviceName: 'iPhone');
  final code = receiver.code;
  final address = receiver.address;
  if (code == null || address == null) {
    stderr.writeln('receiver did not publish a code (${receiver.phase} ${receiver.error})');
    exit(1);
  }
  await sender.startSender(code: code, address: address, deviceName: 'MacBook');
  await _until(() => receiver.phase == SessionPhase.pending);
  final number = receiver.verificationCode ?? '';
  final peer = receiver.peerName ?? S.unknownDevice;
  await receiver.approve();
  await _until(() => sender.phase == SessionPhase.active);
  await sender.sendText('Guest Wi-Fi: tangerine-otter-42');
  await sender.sendText('Garage door: 4821');
  await _until(() => receiver.messages.length == 2);

  runApp(_ShotApp(receiver: receiver, peer: peer, number: number));
}

Future<void> _until(bool Function() done) async {
  final deadline = DateTime.now().add(const Duration(seconds: 10));
  while (!done()) {
    if (DateTime.now().isAfter(deadline)) exit(1);
    await Future<void>.delayed(const Duration(milliseconds: 40));
  }
}

class _ShotApp extends StatefulWidget {
  const _ShotApp({required this.receiver, required this.peer, required this.number});

  final Session receiver;
  final String peer;
  final String number;

  @override
  State<_ShotApp> createState() => _ShotAppState();
}

class _ShotAppState extends State<_ShotApp> {
  final _navigator = GlobalKey<NavigatorState>();

  @override
  void initState() {
    super.initState();
    unawaited(_run());
  }

  Future<void> _run() async {
    await Future<void>.delayed(const Duration(seconds: 2));
    await _shoot('home');
    await _show(const ReceiveScreen());
    await _shoot('receive');
    await _show(_approval());
    await _shoot('approve');
    await _show(const SendScreen());
    _fillCode('K7P4QX');
    await _shoot('send');
    await _show(_chat());
    await _shoot('chat');
    _stage('done');
    exit(0);
  }

  Future<void> _show(Widget screen) async {
    final navigator = _navigator.currentState!;
    final route = MaterialPageRoute<void>(builder: (_) => screen);
    if (navigator.canPop()) {
      unawaited(navigator.pushReplacement(route));
    } else {
      unawaited(navigator.push(route));
    }
    await Future<void>.delayed(const Duration(milliseconds: 1500));
  }

  Future<void> _shoot(String name) async {
    await Future<void>.delayed(const Duration(milliseconds: 500));
    final stage = _stage(name);
    while (stage.existsSync()) {
      await Future<void>.delayed(const Duration(milliseconds: 100));
    }
  }

  File _stage(String name) {
    final stage = File('${Directory.systemTemp.path}/stage');
    final pending = File('${stage.path}.tmp')..writeAsStringSync(name);
    pending.renameSync(stage.path);
    return stage;
  }

  void _fillCode(String code) {
    void visit(Element element) {
      final widget = element.widget;
      if (widget is TextField && widget.decoration?.labelText == S.codeLabel) {
        widget.controller?.text = code;
      }
      element.visitChildren(visit);
    }

    WidgetsBinding.instance.rootElement?.visitChildren(visit);
  }

  Widget _approval() {
    return Stack(
      fit: StackFit.expand,
      children: [
        const ReceiveScreen(),
        const ModalBarrier(color: Colors.black54, dismissible: false),
        AlertDialog(
          title: const Text(S.approveTitle),
          content: Text(S.approveBody(widget.peer, widget.number)),
          actions: [
            TextButton(onPressed: () {}, child: const Text(S.reject)),
            FilledButton(onPressed: () {}, child: const Text(S.approve)),
          ],
        ),
      ],
    );
  }

  Widget _chat() {
    return Scaffold(
      appBar: AppBar(
        title: const Text(S.appName),
        actions: [
          TextButton(onPressed: () {}, child: const Text(S.endSession)),
        ],
      ),
      body: ChatScreen(session: widget.receiver),
    );
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      navigatorKey: _navigator,
      debugShowCheckedModeBanner: false,
      theme: shareGoTheme(),
      home: const HomeScreen(),
    );
  }
}
