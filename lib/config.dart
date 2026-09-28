/// timings, ports, and limits. this is the only place they are defined.
abstract final class AppConfig {
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
}
