import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:cryptography/cryptography.dart';

import '../config.dart';

/// a file attached to a GitHub release.
class ReleaseAsset {
  const ReleaseAsset({required this.name, required this.url, this.sha256});

  final String name;
  final Uri url;

  /// hex SHA-256 that GitHub computed for the file, when it reports one.
  final String? sha256;
}

/// the newest published release of ShareGo on GitHub.
class Release {
  const Release({required this.version, required this.page, required this.assets});

  final String version;
  final Uri page;
  final List<ReleaseAsset> assets;

  ReleaseAsset? asset(String name) {
    for (final asset in assets) {
      if (asset.name == name) return asset;
    }
    return null;
  }

  static Release? fromJson(Map<String, dynamic> json) {
    final tag = json['tag_name'];
    final page = json['html_url'];
    if (tag is! String || page is! String) return null;
    final assets = <ReleaseAsset>[];
    for (final item in (json['assets'] as List<dynamic>? ?? const [])) {
      if (item is! Map<String, dynamic>) continue;
      final name = item['name'];
      final url = item['browser_download_url'];
      if (name is! String || url is! String) continue;
      final digest = item['digest'];
      assets.add(ReleaseAsset(
        name: name,
        url: Uri.parse(url),
        sha256: digest is String && digest.startsWith('sha256:') ? digest.substring(7) : null,
      ));
    }
    return Release(
      version: tag.startsWith('v') ? tag.substring(1) : tag,
      page: Uri.parse(page),
      assets: assets,
    );
  }
}

/// true when [candidate] is a later version than [current]. both are
/// dotted numbers such as 2.0.1; anything after a - or + is ignored.
bool isNewer(String candidate, String current) {
  List<int> parts(String version) => version
      .split(RegExp(r'[-+]'))
      .first
      .split('.')
      .map((part) => int.tryParse(part) ?? 0)
      .toList();
  final a = parts(candidate);
  final b = parts(current);
  for (var i = 0; i < a.length || i < b.length; i++) {
    final x = i < a.length ? a[i] : 0;
    final y = i < b.length ? b[i] : 0;
    if (x != y) return x > y;
  }
  return false;
}

/// false when [ini] has `check=false` under `[updates]`. the installers
/// write ShareGo.ini next to ShareGo.exe when the update check is turned off.
bool updateCheckAllowed(String ini) {
  var section = '';
  for (final raw in const LineSplitter().convert(ini)) {
    final line = raw.trim();
    if (line.startsWith('[') && line.endsWith(']')) {
      section = line.substring(1, line.length - 1).trim().toLowerCase();
      continue;
    }
    final eq = line.indexOf('=');
    if (section != 'updates' || eq < 0) continue;
    if (line.substring(0, eq).trim().toLowerCase() == 'check') {
      return line.substring(eq + 1).trim().toLowerCase() != 'false';
    }
  }
  return true;
}

/// reads ShareGo.ini next to the running executable, if there is one.
bool updateCheckEnabled() {
  final dir = File(Platform.resolvedExecutable).parent.path;
  final file = File('$dir${Platform.pathSeparator}ShareGo.ini');
  try {
    return !file.existsSync() || updateCheckAllowed(file.readAsStringSync());
  } on FileSystemException {
    return true;
  }
}

/// asks GitHub for the latest release. returns null when it is not newer
/// than this build, or when the check fails for any reason.
Future<Release?> checkForUpdate() async {
  final client = HttpClient()..connectionTimeout = AppConfig.connectTimeout;
  try {
    final request = await client.getUrl(AppConfig.latestReleaseApi);
    request.headers.set(HttpHeaders.acceptHeader, 'application/vnd.github+json');
    request.headers.set(HttpHeaders.userAgentHeader, 'ShareGo/${AppConfig.version}');
    final response = await request.close();
    if (response.statusCode != HttpStatus.ok) {
      await response.drain<void>();
      return null;
    }
    final json = jsonDecode(await response.transform(utf8.decoder).join());
    if (json is! Map<String, dynamic>) return null;
    final release = Release.fromJson(json);
    if (release == null || !isNewer(release.version, AppConfig.version)) return null;
    return release;
  } catch (_) {
    return null;
  } finally {
    client.close(force: true);
  }
}

/// downloads [asset] to [file] and checks it against the SHA-256 GitHub
/// reports. throws when the download fails or the hash does not match.
Future<File> download(ReleaseAsset asset, File file) async {
  final expected = asset.sha256;
  if (expected == null) throw const HttpException('the release does not list a SHA-256 for the file');
  final client = HttpClient()..connectionTimeout = AppConfig.connectTimeout;
  try {
    final request = await client.getUrl(asset.url);
    request.headers.set(HttpHeaders.userAgentHeader, 'ShareGo/${AppConfig.version}');
    final response = await request.close();
    if (response.statusCode != HttpStatus.ok) {
      throw HttpException('download failed with status ${response.statusCode}', uri: asset.url);
    }
    final bytes = BytesBuilder(copy: false);
    await for (final chunk in response) {
      bytes.add(chunk);
    }
    final data = bytes.takeBytes();
    final hash = await Sha256().hash(data);
    final actual = hash.bytes.map((b) => b.toRadixString(16).padLeft(2, '0')).join();
    if (actual != expected.toLowerCase()) {
      throw HttpException('the downloaded file does not match its SHA-256', uri: asset.url);
    }
    await file.parent.create(recursive: true);
    return await file.writeAsBytes(data, flush: true);
  } finally {
    client.close(force: true);
  }
}
