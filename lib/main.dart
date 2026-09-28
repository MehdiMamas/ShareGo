import 'package:cryptography/cryptography.dart';
import 'package:cryptography_flutter/cryptography_flutter.dart';
import 'package:flutter/material.dart';

import 'strings.dart';
import 'ui/home_screen.dart';

void main() {
  Cryptography.instance = FlutterCryptography.defaultInstance;
  runApp(const ShareGoApp());
}

class ShareGoApp extends StatelessWidget {
  const ShareGoApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: S.appName,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF1B6B4A)),
        useMaterial3: true,
      ),
      home: const HomeScreen(),
    );
  }
}
