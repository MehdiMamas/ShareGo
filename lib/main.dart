import 'package:cryptography/cryptography.dart';
import 'package:cryptography_flutter/cryptography_flutter.dart';
import 'package:flutter/material.dart';

import 'strings.dart';
import 'ui/home_screen.dart';
import 'ui/theme.dart';

void main() {
  Cryptography.instance = FlutterCryptography.defaultInstance;
  runApp(const ShareGoApp());
}

class ShareGoApp extends StatelessWidget {
  const ShareGoApp({super.key, this.checkForUpdates = true});

  final bool checkForUpdates;

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: S.appName,
      theme: shareGoTheme(),
      home: HomeScreen(checkForUpdates: checkForUpdates),
    );
  }
}
