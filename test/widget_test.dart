import 'package:flutter_test/flutter_test.dart';

import 'package:sharego/main.dart';
import 'package:sharego/strings.dart';

void main() {
  testWidgets('home offers receive and send', (tester) async {
    await tester.pumpWidget(const ShareGoApp());
    expect(find.text(S.appName), findsOneWidget);
    expect(find.text(S.showCode), findsOneWidget);
    expect(find.text(S.enterCode), findsOneWidget);
    expect(find.text(S.tagline), findsOneWidget);
  });
}
