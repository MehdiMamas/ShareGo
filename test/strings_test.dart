import 'package:flutter_test/flutter_test.dart';
import 'package:sharego/strings.dart';

void main() {
  group('S.countdown', () {
    test('formats the seconds into the message', () {
      expect(S.countdown(28), 'New code in 28s');
    });
  });

  group('S.approveBody', () {
    test('contains both the device name and the number', () {
      final body = S.approveBody('Laptop', '123 456');

      expect(body, contains('Laptop'));
      expect(body, contains('123 456'));
    });
  });
}
