# ShareGo

A Flutter app (Android, iOS, macOS, Windows, Linux) that sends a short secret between exactly two devices on the same Wi-Fi. Encrypted on the device, no server, nothing stored.

## Setup and commands
- `flutter pub get` to install dependencies (Dart SDK `^3.13.4` per `pubspec.yaml`).
- `just run` - `flutter run`.
- `just test` - `flutter analyze` then `flutter test`. Run both before a PR; CI runs the same.
- `just build-android | build-ios | build-macos | build-windows | build-linux` - release builds.
- More in `docs/BUILDING.md`.

## Where things live
- `lib/core/` - crypto, frames, protocol, session, discovery, updates.
- `lib/ui/` - screens.
- `lib/strings.dart` - all user-facing text. `lib/config.dart` - timeouts and limits.
- `test/` - tests. `tool/` - screenshot generators.
- `docs/` - ARCHITECTURE, PROTOCOL, THREAT_MODEL, PRIVACY, CODE_SIGNING, CONTRIBUTING, REJECTED.
- `.cursor/rules/` - project invariants, security rules and the version-bump rule.

## Conventions
- Lints: `flutter_lints` (`analysis_options.yaml`).
- CI (`.github/workflows/ci.yml`): `flutter pub get`, `flutter analyze`, `flutter test`. Releases are built from a `vX.Y.Z` tag by `release.yml`.
- The version lives only in the `version` field of `pubspec.yaml`. To release: change it, commit `chore: bump version to x.y.z` (commit `pubspec.lock` if dependencies changed), tag and push `vx.y.z`.

## Gotchas
- No server, relay, cloud fallback, or persisted keys/messages. Exactly two participants; the receiver approves. See `.cursor/rules/sharego-security.mdc` before touching crypto or the session.
- Do not add a dependency for something the Dart or Flutter SDK already does.
- Report vulnerabilities through GitHub private security advisories (`SECURITY.md`).
