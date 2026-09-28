import 'dart:io';

String deviceName() {
  final cleaned = Platform.localHostname.replaceAll(RegExp(r'[\u0000-\u001F\u007F]'), '').trim();
  if (cleaned.isEmpty) return 'Device';
  return cleaned.length <= 40 ? cleaned : cleaned.substring(0, 40);
}

bool get canScanQr => Platform.isAndroid || Platform.isIOS;
