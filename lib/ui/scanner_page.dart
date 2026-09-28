import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import '../core/protocol.dart';
import '../strings.dart';

class ScannerPage extends StatefulWidget {
  const ScannerPage({super.key});

  @override
  State<ScannerPage> createState() => _ScannerPageState();
}

class _ScannerPageState extends State<ScannerPage> {
  var _done = false;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text(S.scanQr)),
      body: Column(
        children: [
          const Padding(
            padding: EdgeInsets.all(16),
            child: Text(S.scanHint),
          ),
          Expanded(
            child: MobileScanner(
              onDetect: (capture) {
                if (_done) return;
                if (capture.barcodes.isEmpty) return;
                final raw = capture.barcodes.first.rawValue;
                if (raw == null) return;
                final payload = QrPayload.tryParse(raw);
                if (payload == null) return;
                _done = true;
                Navigator.pop(context, payload);
              },
            ),
          ),
        ],
      ),
    );
  }
}
