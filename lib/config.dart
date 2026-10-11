/// timings, ports, and limits. this is the only place they are defined.
abstract final class AppConfig {
  /// must match the version in pubspec.yaml (test/config_test.dart checks).
  static const version = '2.0.2';
  static const protocolVersion = 2;
  static const bootstrapTtl = Duration(seconds: 30);
  static const sessionTtl = Duration(minutes: 5);
  static const approvalTimeout = Duration(seconds: 60);
  static const connectTimeout = Duration(seconds: 10);
  static const discoveryTimeout = Duration(seconds: 5);
  static const defaultPort = 4040;
  static const codeLength = 6;
  static const maxFrameSize = 65536;
  static const maxTextLength = 8000;
  static const mdnsType = '_sharego._tcp';
  static const updateCheckInterval = Duration(hours: 6);
  static final latestReleaseApi =
      Uri.parse('https://api.github.com/repos/MehdiMamas/ShareGo/releases/latest');
}
