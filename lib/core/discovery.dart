import 'dart:async';

import 'package:bonsoir/bonsoir.dart';

import '../config.dart';

/// mDNS advertise and browse. address entry still works when this fails.
class LanDiscovery {
  BonsoirBroadcast? _broadcast;

  Future<void> advertise({required String code, required int port}) async {
    await stopAdvertising();
    final broadcast = BonsoirBroadcast(
      service: BonsoirService(
        name: 'ShareGo-$code',
        type: AppConfig.mdnsType,
        port: port,
        attributes: {'code': code},
      ),
    );
    await broadcast.initialize();
    await broadcast.start();
    _broadcast = broadcast;
  }

  Future<void> stopAdvertising() async {
    final broadcast = _broadcast;
    _broadcast = null;
    if (broadcast == null) return;
    try {
      await broadcast.stop();
    } catch (_) {}
  }

  /// returns `host:port` for the service advertising [code], or null.
  Future<String?> find(
    String code, {
    Duration timeout = AppConfig.discoveryTimeout,
  }) async {
    final discovery = BonsoirDiscovery(type: AppConfig.mdnsType);
    StreamSubscription<BonsoirDiscoveryEvent>? subscription;
    try {
      await discovery.initialize();
      final found = Completer<String?>();
      final stream = discovery.eventStream;
      if (stream == null) return null;
      subscription = stream.listen((event) {
        if (event is BonsoirDiscoveryServiceFoundEvent) {
          unawaited(
            event.service.resolve(discovery.serviceResolver).then(
              (_) {},
              onError: (Object _, StackTrace _) {},
            ),
          );
          return;
        }
        if (event is! BonsoirDiscoveryServiceResolvedEvent) return;
        if (event.service.attributes['code'] != code || found.isCompleted) return;
        final host = _ipv4(event.service);
        if (host == null) return;
        found.complete('$host:${event.service.port}');
      });
      await discovery.start();
      return await found.future.timeout(timeout, onTimeout: () => null);
    } catch (_) {
      return null;
    } finally {
      await subscription?.cancel();
      try {
        await discovery.stop();
      } catch (_) {}
    }
  }

  Future<void> stop() => stopAdvertising();
}

String? _ipv4(BonsoirService service) {
  for (final raw in service.hostAddresses) {
    final ip = raw.split('%').first;
    if (ip.contains(':') || ip.startsWith('169.254.') || ip == '0.0.0.0') {
      continue;
    }
    return ip;
  }
  return null;
}
