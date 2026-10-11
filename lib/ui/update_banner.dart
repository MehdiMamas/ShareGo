import 'dart:async';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../config.dart';
import '../core/updates.dart';
import '../strings.dart';

/// tells desktop users when a newer release is on GitHub, and installs it
/// where the platform allows: the setup exe on Windows, the DMG on macOS.
/// everywhere else it links to the release page.
class UpdateBanner extends StatefulWidget {
  const UpdateBanner({super.key});

  @override
  State<UpdateBanner> createState() => _UpdateBannerState();
}

class _UpdateBannerState extends State<UpdateBanner> {
  Timer? _timer;
  Release? _release;
  String? _message;
  bool _busy = false;
  bool _dismissed = false;

  static bool get _desktop => Platform.isWindows || Platform.isMacOS || Platform.isLinux;

  // the setup exe leaves its uninstaller next to ShareGo.exe. the MSI and
  // the zip do not, and are updated by hand.
  static bool get _installedWithSetup {
    final dir = File(Platform.resolvedExecutable).parent.path;
    return File('$dir${Platform.pathSeparator}unins000.exe').existsSync();
  }

  @override
  void initState() {
    super.initState();
    if (!_desktop) return;
    _check();
    _timer = Timer.periodic(AppConfig.updateCheckInterval, (_) => _check());
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  Future<void> _check() async {
    final release = await checkForUpdate();
    if (!mounted || release == null || _busy) return;
    setState(() {
      if (release.version != _release?.version) _dismissed = false;
      _release = release;
    });
  }

  ReleaseAsset? _installer(Release release) {
    if (Platform.isMacOS) return release.asset('ShareGo-macos.dmg');
    if (Platform.isWindows && _installedWithSetup) return release.asset('ShareGo-windows-setup.exe');
    return null;
  }

  Future<void> _install(Release release, ReleaseAsset asset) async {
    setState(() {
      _busy = true;
      _message = S.downloadingUpdate;
    });
    try {
      if (Platform.isWindows) {
        final file = await download(asset, File('${Directory.systemTemp.path}\\${asset.name}'));
        // quit so the installer can replace ShareGo.exe. it reopens ShareGo when done.
        await Process.start(file.path, ['/SILENT', '/SP-', '/SUPPRESSMSGBOXES', '/NORESTART'],
            mode: ProcessStartMode.detached);
        exit(0);
      }
      final home = Platform.environment['HOME'] ?? Directory.systemTemp.path;
      final file = await download(asset, File('$home/Downloads/ShareGo-${release.version}.dmg'));
      await launchUrl(Uri.file(file.path));
      if (mounted) {
        setState(() {
          _busy = false;
          _message = S.dragToApplications;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _busy = false;
          _message = S.updateFailed;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final release = _release;
    if (release == null || _dismissed) return const SizedBox.shrink();
    final installer = _installer(release);
    final message = _message;
    return Card(
      margin: const EdgeInsets.only(bottom: 32),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(S.updateAvailable(release.version), style: Theme.of(context).textTheme.titleMedium),
            if (message != null) ...[
              const SizedBox(height: 8),
              Text(message),
            ],
            const SizedBox(height: 8),
            Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                TextButton(
                  onPressed: _busy ? null : () => setState(() => _dismissed = true),
                  child: const Text(S.later),
                ),
                const SizedBox(width: 8),
                FilledButton(
                  onPressed: _busy
                      ? null
                      : () => installer == null ? launchUrl(release.page) : _install(release, installer),
                  child: Text(installer == null ? S.download : S.update),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
