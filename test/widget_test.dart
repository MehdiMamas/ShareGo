import 'package:flutter/material.dart';
import 'package:sharego/core/session.dart';
import 'package:sharego/ui/chat_screen.dart';

import 'package:flutter_test/flutter_test.dart';

import 'package:sharego/main.dart';
import 'package:sharego/strings.dart';

void main() {
  testWidgets('home offers receive and send', (tester) async {
    await tester.pumpWidget(const ShareGoApp(checkForUpdates: false));
    expect(find.text(S.appName), findsOneWidget);
    expect(find.text(S.showCode), findsOneWidget);
    expect(find.text(S.enterCode), findsOneWidget);
    expect(find.text(S.tagline), findsOneWidget);
  });

  testWidgets('empty chat shows placeholder, input and send button', (
    tester,
  ) async {
    final session = Session();
    addTearDown(session.dispose);

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(body: ChatScreen(session: session)),
      ),
    );

    expect(find.text(S.emptyChat), findsOneWidget);
    expect(find.text(S.messageHint), findsOneWidget);
    expect(find.widgetWithText(FilledButton, S.send), findsOneWidget);
  });
}
