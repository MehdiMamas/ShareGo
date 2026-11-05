Send a password, code, or note to one other device on the same Wi-Fi. Encrypted on the device, nothing stored, no server.

<p align="center">
  <img src="docs/images/icon.png" width="128" alt="ShareGo icon">
</p>

<h1 align="center">ShareGo</h1>

<p align="center">
  <a href="https://github.com/MehdiMamas/ShareGo/releases/latest"><strong>Download the latest release</strong></a><br>
  <a href="docs/CODE_SIGNING.md">Code signing policy</a> · <a href="docs/PRIVACY.md">Privacy policy</a>
</p>

<p align="center">
  <img src="docs/images/demo.gif" width="560" alt="ShareGo: show a code, enter it on the other device, send a secret">
</p>

<p align="center">
  <img src="docs/images/home.png" width="280" alt="ShareGo home">
  <img src="docs/images/receive.png" width="280" alt="A ShareGo code and QR">
  <img src="docs/images/chat.png" width="280" alt="A delivered secret">
</p>

## Download

| File | What to do |
| --- | --- |
| [ShareGo-windows-setup.exe](https://github.com/MehdiMamas/ShareGo/releases/latest/download/ShareGo-windows-setup.exe) | Run the installer. No admin rights needed. ShareGo updates itself from then on. Allow it on private networks when Windows asks. |
| [ShareGo-windows.msi](https://github.com/MehdiMamas/ShareGo/releases/latest/download/ShareGo-windows.msi) | Installs for all users, for admins and deployment tools. Update it with the next MSI. |
| [ShareGo-windows.zip](https://github.com/MehdiMamas/ShareGo/releases/latest/download/ShareGo-windows.zip) | Unzip and run `ShareGo.exe`, no install. |
| [ShareGo-macos.dmg](https://github.com/MehdiMamas/ShareGo/releases/latest/download/ShareGo-macos.dmg) | Open the disk image and drag ShareGo to Applications. |
| [ShareGo-android.apk](https://github.com/MehdiMamas/ShareGo/releases/latest/download/ShareGo-android.apk) | Install the APK. |
| [ShareGo-linux.tar.gz](https://github.com/MehdiMamas/ShareGo/releases/latest/download/ShareGo-linux.tar.gz) | Unpack and run `ShareGo`. |
| [ShareGo-unsigned.ipa](https://github.com/MehdiMamas/ShareGo/releases/latest/download/ShareGo-unsigned.ipa) | Sideload with AltStore or Sideloadly. |

The desktop apps check GitHub for a new release when they start and every 6 hours. On Windows (setup exe) the update installs with one click and ShareGo reopens. On macOS the new DMG is downloaded and opened; drag ShareGo to Applications to replace the old copy. Both Windows installers let you turn the check off; see the [privacy policy](docs/PRIVACY.md).

Windows releases are signed through SignPath; see the [code signing policy](docs/CODE_SIGNING.md). Until a signed release is out, SmartScreen may warn on first run. Choose **More info**, then **Run anyway**.

### Install from a terminal (Linux)

```bash
mkdir sharego && curl -sSL https://github.com/MehdiMamas/ShareGo/releases/latest/download/ShareGo-linux.tar.gz | tar xz -C sharego && ./sharego/ShareGo
```

There is no package-manager channel yet. On the other platforms, use the table above.

## How a transfer works

1. On the device that will receive, tap **Show a code**. It shows a QR code, a 6-character code, and an address. They change every 30 seconds until someone connects.
2. On the other device, tap **Enter a code**. Scan the QR code, or type the code. If the code is not found on the network, type the address shown on the first device.
3. Both screens show the same number. Compare it, then tap **Approve** on the receiving device. A QR scan also checks the public key in the code.
4. Type the secret and send it. **End session** closes the connection and clears the messages.

Exactly two devices. A third device cannot join. Start a new code for a new pair.

<p align="center">
  <img src="docs/images/send.png" width="320" alt="Enter a code">
</p>

## What stays on the Wi-Fi

- The two devices talk over TCP on the local network. There is no cloud, relay, or signup.
- Each code uses a new X25519 key. The message key is derived with HKDF-SHA256 and the text is encrypted with XChaCha20-Poly1305.
- Keys and messages are wiped when the session ends. Nothing is written to disk.

## Develop

Flutter stable, plus the SDK for the platform you run. See [docs/BUILDING.md](docs/BUILDING.md).

```bash
flutter pub get
flutter test
flutter run
```

- [Protocol](docs/PROTOCOL.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Threat model](docs/THREAT_MODEL.md)
- [Security policy](SECURITY.md)

## Credits

ShareGo is built with [Flutter](https://flutter.dev) and these open-source packages: [cryptography](https://pub.dev/packages/cryptography) and [cryptography_flutter](https://pub.dev/packages/cryptography_flutter) (X25519, HKDF, XChaCha20-Poly1305), [bonsoir](https://pub.dev/packages/bonsoir) (local network discovery), [mobile_scanner](https://pub.dev/packages/mobile_scanner) (QR scanning), [qr_flutter](https://pub.dev/packages/qr_flutter) (QR codes) and [url_launcher](https://pub.dev/packages/url_launcher). Thanks to their authors. Windows releases are signed through [SignPath](https://signpath.org).

## License

[MIT](LICENSE)
