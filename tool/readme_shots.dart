import 'dart:async';
import 'dart:io';
import 'dart:ui' as ui;

import 'package:cryptography/cryptography.dart';
import 'package:cryptography_flutter/cryptography_flutter.dart';
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:sharego/core/session.dart';
import 'package:sharego/strings.dart';
import 'package:sharego/ui/chat_screen.dart';
import 'package:sharego/ui/home_screen.dart';
import 'package:sharego/ui/receive_screen.dart';
import 'package:sharego/ui/send_screen.dart';

/// runs the real macOS window through each screen so the readme shots use the
/// app's fonts. the capture script watches for lines that start with STAGE.
Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  Cryptography.instance = FlutterCryptography.defaultInstance;
  final receiver = Session();
  final sender = Session();
  await receiver.startReceiver(deviceName: 'MacBook');
  final code = receiver.code;
  final address = receiver.address;
  if (code == null || address == null) {
    stderr.writeln('receiver did not publish a code (${receiver.phase} ${receiver.error})');
    exit(1);
  }
  await sender.startSender(code: code, address: address, deviceName: 'Windows');
  final deadline = DateTime.now().add(const Duration(seconds: 8));
  while (receiver.phase != SessionPhase.pending) {
    if (DateTime.now().isAfter(deadline)) exit(1);
    await Future<void>.delayed(const Duration(milliseconds: 40));
  }
  await receiver.approve();
  while (sender.phase != SessionPhase.active) {
    if (DateTime.now().isAfter(deadline)) exit(1);
    await Future<void>.delayed(const Duration(milliseconds: 40));
  }
  await sender.sendText('garage: 4821');

  runApp(_ShotApp(sender: sender));
}

class _ShotApp extends StatefulWidget {
  const _ShotApp({required this.sender});

  final Session sender;

  @override
  State<_ShotApp> createState() => _ShotAppState();
}

class _ShotAppState extends State<_ShotApp> {
  static const _order = ['home', 'receive', 'send', 'chat'];
  final _boundary = GlobalKey();
  var _index = 0;

  @override
  void initState() {
    super.initState();
    unawaited(_run());
  }

  Future<void> _run() async {
    for (var i = 0; i < _order.length; i++) {
      setState(() => _index = i);
      final pause = _order[i] == 'receive' ? 1500 : 700;
      await Future<void>.delayed(Duration(milliseconds: pause));
      await _save(_order[i]);
    }
    stderr.writeln('STAGE done');
    exit(0);
  }

  Future<void> _save(String name) async {
    final boundary = _boundary.currentContext?.findRenderObject() as RenderRepaintBoundary?;
    if (boundary == null) {
      stderr.writeln('no boundary for $name');
      return;
    }
    final image = await boundary.toImage(pixelRatio: 2);
    final data = await image.toByteData(format: ui.ImageByteFormat.png);
    final file = File('${Directory.systemTemp.path}/sharego-$name.png');
    file.writeAsBytesSync(data!.buffer.asUint8List());
    stderr.writeln('SHOTFILE ${file.path}');
  }

  @override
  Widget build(BuildContext context) {
    final name = _order[_index];
    final Widget screen = switch (name) {
      'receive' => const ReceiveScreen(),
      'send' => const SendScreen(),
      'chat' => _chat(widget.sender),
      _ => const HomeScreen(),
    };
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF1B6B4A)),
        useMaterial3: true,
      ),
      home: RepaintBoundary(key: _boundary, child: screen),
    );
  }

  Widget _chat(Session sender) {
    return Scaffold(
      appBar: AppBar(
        title: const Text(S.appName),
        actions: [
          TextButton(onPressed: () {}, child: const Text(S.endSession)),
        ],
      ),
      body: ChatScreen(session: sender),
    );
  }
}
