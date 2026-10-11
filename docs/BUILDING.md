# Building

Install [Flutter](https://docs.flutter.dev/get-started/install) stable, then:

```bash
flutter pub get
flutter doctor
flutter test
flutter run
```

`just test` and `just build-macos` (and the other `just build-*` recipes) do the same thing if you have [just](https://github.com/casey/just) installed.

Windows binaries are built on Windows. A Mac cannot produce the `.exe`. Linux binaries are built on Linux.

## Android

Install Android Studio or the command-line SDK. `flutter build apk --release` writes `build/app/outputs/flutter-apk/app-release.apk`.

Without `android/key.properties`, the release APK is signed with the debug key. That is fine for a one-off install. To sign with a key you can reuse:

```bash
keytool -genkey -v -keystore upload-keystore.jks -keyalg RSA -keysize 2048 -validity 10000 -alias upload
```

`android/key.properties` (not committed):

```
storePassword=...
keyPassword=...
keyAlias=upload
storeFile=upload-keystore.jks
```

Put `upload-keystore.jks` in `android/app/`. For GitHub Releases, set these repository secrets so the workflow signs with the same key:

- `ANDROID_KEYSTORE_BASE64` (base64 of the `.jks` file)
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_PASSWORD`
- `ANDROID_KEY_ALIAS`

If the secrets are absent, the release APK is still built and signed with the runner's debug key.

## macOS

`flutter build macos --release` writes `build/macos/Build/Products/Release/ShareGo.app`. The app is sandboxed and is allowed incoming and outgoing network connections.

A local build is unsigned. macOS will say it cannot be opened. Use System Settings, or `xattr -dr com.apple.quarantine` on the app after you have checked the download.

The release workflow signs the app with the Developer ID Application certificate (hardened runtime), signs the DMG, notarizes it with `notarytool` and staples the ticket. It needs the Apple secrets listed below. Without them the DMG is built unsigned.

## iOS

`flutter build ios --release --no-codesign` produces an unsigned `Runner.app`. The release workflow zips it as `Payload/Runner.app` into `ShareGo-unsigned.ipa` for AltStore or Sideloadly.

With the Apple secrets set, the workflow also runs `flutter build ipa` with manual signing (Apple Distribution certificate and the `ShareGo App Store` profile) and uploads the IPA to TestFlight. The build number is the workflow run number, so each upload is new.

The camera, local network, and Bonjour usage strings are in `ios/Runner/Info.plist`.

## Apple secrets

Team `7LPSQ8W7G8`, bundle ID `dev.sharego.sharego`. Repository secrets used by the release workflow:

- `APPLE_TEAM_ID`
- `APPLE_API_KEY_ID`, `APPLE_API_ISSUER_ID`, `APPLE_API_KEY_P8_BASE64`: an App Store Connect team API key (Admin), used for notarization and TestFlight upload
- `APPLE_DISTRIBUTION_P12_BASE64`: Apple Distribution certificate and key (iOS)
- `APPLE_DEVELOPER_ID_P12_BASE64`: Developer ID Application certificate and key (macOS)
- `APPLE_P12_PASSWORD`: password of both `.p12` files
- `IOS_PROFILE_BASE64`: the `ShareGo App Store` provisioning profile

The profile expires with the Apple Distribution certificate after a year. Renew both and update the secrets. The Developer ID certificate lasts five years. Only the Account Holder can create it, on the developer website.

## Windows

`flutter build windows --release`. Zip the contents of `build/windows/x64/runner/Release/`. The first run may ask to allow ShareGo through the firewall. Allow it on private networks.

## Linux

Install `clang`, `cmake`, `ninja-build`, `pkg-config`, `libgtk-3-dev`, `liblzma-dev`, `libavahi-client-dev`, and `libavahi-common-dev`. Then `flutter build linux --release`. The bundle is `build/linux/x64/release/bundle/`.

## Releases

Pushing a tag `v*` runs `.github/workflows/release.yml`, which builds all five artifacts and attaches them to a GitHub Release. `flutter analyze` and `flutter test` run on every push and pull request.
