# ShareGo

ShareGo sends a secret from one device to one other device on the same Wi-Fi. The two devices talk over TCP on the local network. The message is encrypted on the device before it is sent. Nothing is stored, and nothing is sent to a server.

## Download

GitHub Releases, from a `v*` tag, attach:

| File | Platform |
| --- | --- |
| `ShareGo-android.apk` | Android. Install the APK. |
| `ShareGo-windows.zip` | Windows. Unzip and run `ShareGo.exe`. |
| `ShareGo-macos.dmg` | macOS. Open the disk image and move ShareGo to Applications. Unsigned until an Apple Developer account is added, so Gatekeeper will warn. |
| `ShareGo-unsigned.ipa` | iOS. Sideload with AltStore or Sideloadly until the app is signed. |
| `ShareGo-linux.tar.gz` | Linux. Unpack and run `ShareGo`. |

## Use it

1. On the device that will receive, tap **Show a code**. It shows a QR code, a 6-character code, and an address. These change every 30 seconds until someone connects.
2. On the other device, tap **Enter a code**. Scan the QR code (phone only), or type the code. If the code is not found on the network, type the address shown on the first device.
3. Both screens show the same 6-digit number. A QR scan also checks the public key in the code. Compare the number, then tap **Approve** on the receiving device.
4. Type the secret and send it. **End session** closes the connection and clears the messages.

Exactly two devices. A third device cannot join. Start a new code for a new pair.

## Develop

Flutter stable, plus the SDK for the platform you run. See [docs/BUILDING.md](docs/BUILDING.md).

```bash
flutter pub get
flutter test
flutter run
```

## Read more

- [Protocol](docs/PROTOCOL.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Threat model](docs/THREAT_MODEL.md)
- [Security policy](SECURITY.md)
