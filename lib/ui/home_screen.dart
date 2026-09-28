import 'package:flutter/material.dart';

import '../strings.dart';
import 'receive_screen.dart';
import 'send_screen.dart';

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 420),
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(S.appName, style: Theme.of(context).textTheme.headlineLarge),
                  const SizedBox(height: 12),
                  Text(S.tagline, style: Theme.of(context).textTheme.bodyLarge),
                  const SizedBox(height: 32),
                  FilledButton(
                    onPressed: () => _open(context, const ReceiveScreen()),
                    child: const Text(S.showCode),
                  ),
                  const SizedBox(height: 12),
                  OutlinedButton(
                    onPressed: () => _open(context, const SendScreen()),
                    child: const Text(S.enterCode),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  void _open(BuildContext context, Widget screen) {
    Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => screen));
  }
}
