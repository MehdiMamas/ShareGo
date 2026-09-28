# Contributing

ShareGo is one Flutter application. Crypto, framing, and the session live in `lib/core/`. Screens live in `lib/ui/`. User-facing text lives in `lib/strings.dart`. Timeouts and limits live in `lib/config.dart`.

Before opening a pull request:

```bash
flutter analyze
flutter test
```

Do not add a server, a relay, or a way to persist keys or messages. Do not add a dependency for something the Dart or Flutter SDK already does.

Report vulnerabilities through GitHub private security advisories, not a public issue. See [SECURITY.md](../SECURITY.md).
