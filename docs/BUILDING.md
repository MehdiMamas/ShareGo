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

Team `7LPSQ8W7G8`, bundle ID `com.mehdimamas.sharego`. Repository secrets used by the release workflow:

- `APPLE_TEAM_ID`
- `APPLE_API_KEY_ID`, `APPLE_API_ISSUER_ID`, `APPLE_API_KEY_P8_BASE64`: an App Store Connect team API key (Admin), used for notarization and TestFlight upload
- `APPLE_DISTRIBUTION_P12_BASE64`: Apple Distribution certificate and key (iOS)
- `APPLE_DEVELOPER_ID_P12_BASE64`: Developer ID Application certificate and key (macOS)
- `APPLE_P12_PASSWORD`: password of both `.p12` files
- `IOS_PROFILE_BASE64`: the `ShareGo App Store` provisioning profile

The profile expires with the Apple Distribution certificate after a year. Renew both and update the secrets. The Developer ID certificate lasts five years. Only the Account Holder can create it, on the developer website.

## App Store

The listing is app `6821553536` in App Store Connect ("ShareGo: Wi-Fi Secret Share"). The privacy policy it links to is [PRIVACY.md](PRIVACY.md).

Screenshots come from the **Store screenshots** workflow (run it by hand). It runs `tool/store_shots.dart` in the largest iPhone and iPad simulators, and `tool/store_shots.sh` saves each screen, status bar included, as the `store-shots` artifact.

Export compliance was answered as "standard encryption algorithms, not distributed in France", so `ITSAppUsesNonExemptEncryption` is `false` in `ios/Runner/Info.plist`. France is turned off under Pricing and Availability. Selling there needs an encryption declaration to ANSSI first, then those answers change.

## Windows

`flutter build windows --release` writes `build/windows/x64/runner/Release/`. The first run may ask to allow ShareGo through the firewall. Allow it on private networks.

The release workflow copies `msvcp140.dll`, `vcruntime140.dll` and `vcruntime140_1.dll` into that folder, so ShareGo starts on a PC without the Visual C++ runtime, and then builds three files from it:

- `ShareGo-windows.zip`: the folder as is.
- `ShareGo-windows-setup.exe`: [Inno Setup 6](https://jrsoftware.org/isinfo.php), from `windows/installer/ShareGo.iss`. Installs for the current user without admin rights. This is the copy that updates itself.
  ```
  iscc /DAppVersion=2.0.2 /DSourceDir=<Release folder> windows\installer\ShareGo.iss
  ```
- `ShareGo-windows.msi`: [WiX 5](https://wixtoolset.org), from `windows/installer/ShareGo.wxs`. Installs for all users in Program Files.
  ```
  dotnet tool install --global wix --version 5.0.2
  wix extension add -g WixToolset.UI.wixext/5.0.2
  wix build -arch x64 -ext WixToolset.UI.wixext -d Version=2.0.2 -d SourceDir=<Release folder> -o ShareGo-windows.msi windows\installer\ShareGo.wxs
  ```

Both installers show `windows/installer/privacy.txt` (the MSI shows it with the license, from `license.rtf`) and let the user turn the update check off. The setup exe has a **Check for updates** task; the MSI takes `UPDATECHECK=0`. Either writes `ShareGo.ini` next to `ShareGo.exe` with `check=false` under `[updates]`, which `updateCheckEnabled()` in `lib/core/updates.dart` reads. If you change what ShareGo sends over the network, update `privacy.txt`, `license.rtf` and [PRIVACY.md](PRIVACY.md) together.

### Signing with SignPath

Windows releases are signed through [SignPath Foundation](https://signpath.org) under the [code signing policy](CODE_SIGNING.md). On a tag, or on a manual run with **sign** checked, the release workflow makes two signing requests and waits for each to be approved in SignPath:

1. `ShareGo.exe`, before the zip and the installers are made, so all three carry the signed copy.
2. `ShareGo-windows-setup.exe` and `ShareGo-windows.msi`.

It then checks each signature with `Get-AuthenticodeSignature`. Signing is skipped while the `SIGNPATH_ORGANIZATION_ID` variable is unset. One-time setup in SignPath and GitHub:

- SignPath project `sharego`, linked to this repository as a GitHub trusted build system, with the SignPath GitHub App installed on it.
- Artifact configurations `exe` and `installers`, copied from [.signpath/artifact-configurations](../.signpath/artifact-configurations). Change them here first, then in SignPath.
- Signing policy `release-signing`, with manual approval.
- Repository variable `SIGNPATH_ORGANIZATION_ID` and secret `SIGNPATH_API_TOKEN` (a CI user's token with submitter rights on `release-signing`).

## Linux

Install `clang`, `cmake`, `ninja-build`, `pkg-config`, `libgtk-3-dev`, `liblzma-dev`, `libavahi-client-dev`, and `libavahi-common-dev`. Then `flutter build linux --release`. The bundle is `build/linux/x64/release/bundle/`.

## Releases

Pushing a tag `v*` runs `.github/workflows/release.yml`, which builds every artifact, signs the Windows files, attaches them to a draft GitHub Release and uploads the iOS build to TestFlight. Running the workflow by hand (`gh workflow run release.yml --ref <branch>`) builds the same artifacts but publishes nothing. `flutter analyze` and `flutter test` run on every push and pull request.

Before tagging, bump `version` in `pubspec.yaml` and `AppConfig.version` in `lib/config.dart` together. A test fails when they differ.

### Updates

The desktop apps read `https://api.github.com/repos/MehdiMamas/ShareGo/releases/latest` at launch and every 6 hours (`lib/core/updates.dart`). A release counts as newer when its tag, without the `v`, is a higher version than `AppConfig.version`. Downloads are checked against the SHA-256 that GitHub reports for each asset, and are refused when it is missing or does not match.

- Windows, installed with the setup exe: downloads `ShareGo-windows-setup.exe`, runs it with `/SILENT`, and quits. The installer reopens ShareGo.
- macOS: downloads `ShareGo-macos.dmg` to Downloads and opens it.
- MSI, zip, and Linux: opens the release page.

So the asset names must stay the same from release to release.
