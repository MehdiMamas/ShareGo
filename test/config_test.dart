import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:sharego/config.dart';

void main() {
  test('AppConfig.version matches pubspec.yaml', () {
    final line = File('pubspec.yaml').readAsLinesSync().firstWhere((l) => l.startsWith('version:'));
    expect(line.substring(8).trim().split('+').first, AppConfig.version);
  });
}
