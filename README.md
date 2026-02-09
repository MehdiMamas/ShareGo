# ShareGo

serverless, end-to-end encrypted, local-network-only sharing for sensitive data between two devices on the same Wi-Fi.

no cloud. no relay. no signaling. no internet required.

## what it does

share passwords, OTPs, and sensitive text between exactly two devices on the same network. receiver creates a session, sender scans a QR code or enters a manual code, receiver approves, and data flows — encrypted end-to-end with ephemeral keys that never touch disk.

## platforms

| platform | shell | status |
|----------|-------|--------|
| windows | electron | code complete |
| macOS | electron | code complete |
| linux | electron | code complete |
| android | react native bare | code complete |
| iOS | react native bare | code complete |

## quick start

### one-command setup

```bash
git clone https://github.com/MehdiMamas/ShareGo.git
cd ShareGo

# auto-detect your platform and set everything up
./scripts/setup.sh
```

the setup script installs all dependencies, builds the core library, and runs platform-specific setup (CocoaPods for iOS, etc.) automatically.

### platform-specific setup

```bash
./scripts/setup.sh ios        # iOS only
./scripts/setup.sh android    # Android only
./scripts/setup.sh desktop    # desktop (Electron) only
./scripts/setup.sh core       # core library only
```

### run the app

```bash
# desktop (any OS)
pnpm run dev:desktop

# iOS simulator (macOS only)
pnpm run dev:ios

# iOS device (macOS only)
pnpm run dev:ios:device

# android
pnpm run dev:android

# just the metro bundler (mobile)
pnpm run dev:mobile
```

## iOS setup

iOS requires macOS, Xcode, and CocoaPods. the minimum iOS version is **13.4** (iPhone 6s and later).

### fastest way

```bash
./scripts/setup.sh ios        # installs everything
./scripts/dev-ios.sh           # runs on simulator
./scripts/dev-ios.sh --device  # runs on your iPhone
```

### manual setup

```bash
pnpm install                           # install all dependencies
pnpm run build:core                    # build shared core library
cd apps/app/ios && pod install         # install native iOS deps
cd ..
npx react-native run-ios              # run on simulator
npx react-native run-ios --device     # run on iPhone
```

### running on a physical iPhone

1. open `apps/app/ios/ShareGo.xcworkspace` in Xcode
2. go to **Signing & Capabilities** and select your Apple ID as the team
3. connect your iPhone via USB and tap "Trust This Computer"
4. on your iPhone: **Settings > General > VPN & Device Management** — trust your developer certificate
5. select your device in Xcode and press Run (⌘R)

> a free Apple ID works for development. see [docs/IOS_GUIDE.md](docs/IOS_GUIDE.md) for the complete guide with troubleshooting.

## android setup

requires Android Studio, JDK 17+, and Android SDK (API 34).

```bash
./scripts/setup.sh android           # check prerequisites
cd apps/app
npx react-native run-android         # run on emulator or device
```

see [docs/BUILDING.md](docs/BUILDING.md) for detailed Android setup.

## desktop setup

```bash
./scripts/setup.sh desktop    # install platform deps

# development
pnpm run dev:desktop

# production build
pnpm run build:desktop
```

build outputs: `.dmg` (macOS), `.exe`/NSIS (Windows), `.AppImage`/`.deb` (Linux).

see [docs/BUILDING.md](docs/BUILDING.md) for detailed desktop setup.

## how it works

```
receiver                          sender
   |                                |
   |  create session, show QR      |
   |  <--------------------------  |  scan QR or enter code
   |                                |
   |  HELLO (sender public key)    |
   |  <--------------------------  |
   |                                |
   |  CHALLENGE (nonce + recv pk)  |
   |  -------------------------->  |
   |                                |
   |  AUTH (encrypted nonce proof) |
   |  <--------------------------  |
   |                                |
   |  ACCEPT / REJECT             |
   |  -------------------------->  |
   |                                |
   |  DATA <-> ACK (encrypted)    |
   |  <========================>  |
   |                                |
   |  CLOSE                        |
   |  <========================>  |
```

## security

- **crypto**: X25519 key exchange, XChaCha20-Poly1305 AEAD encryption (libsodium)
- **keys**: ephemeral per session, never persisted, zeroed on close
- **transport**: local WebSocket on LAN only — no internet traffic
- **participants**: exactly 2 per session, receiver must approve sender
- **replay protection**: monotonic sequence numbers on every message

see [docs/THREAT_MODEL.md](docs/THREAT_MODEL.md) for the full threat analysis.

## project structure

```
core/               shared typescript library (crypto, protocol, session, transport)
apps/
  app/              unified app (electron desktop + react native mobile)
  app/electron/     electron main process (ws server, ipc, mdns)
  app/src/          react native + react-native-web UI (all platforms)
scripts/            setup, build, check, dev convenience scripts
docs/               architecture, protocol spec, threat model, ios guide
```

all security logic lives in `@sharego/core`. app shells are thin wrappers that provide platform-specific APIs (websocket server, camera, clipboard) and UI.

## all scripts

| script | description |
|---|---|
| `pnpm run setup` | one-command setup for all platforms |
| `pnpm run setup:ios` | setup for iOS development |
| `pnpm run setup:android` | setup for Android development |
| `pnpm run setup:desktop` | setup for desktop development |
| `pnpm run dev:desktop` | start desktop app in dev mode |
| `pnpm run dev:mobile` | start metro bundler |
| `pnpm run dev:ios` | run iOS app on simulator |
| `pnpm run dev:ios:device` | run iOS app on physical iPhone |
| `pnpm run dev:android` | run Android app on emulator/device |
| `pnpm run build:core` | build core library |
| `pnpm run build:ios` | release build for iOS |
| `pnpm run build:android` | release build for Android |
| `pnpm run build:desktop` | release build for desktop |
| `pnpm run test:core` | run core library tests |
| `pnpm run check` | check all prerequisites |
| `pnpm run check:ios` | check iOS prerequisites |
| `pnpm run check:android` | check Android prerequisites |
| `pnpm run check:desktop` | check desktop prerequisites |

## environment

no `.env` files. no API keys. no cloud services. all crypto keys are ephemeral and generated at runtime.

## docs

- [IOS_GUIDE.md](docs/IOS_GUIDE.md) — complete iOS setup, device deployment, troubleshooting
- [BUILDING.md](docs/BUILDING.md) — detailed build instructions for all platforms
- [ARCHITECTURE.md](docs/ARCHITECTURE.md) — system design and platform notes
- [PROTOCOL.md](docs/PROTOCOL.md) — wire format, message types, session lifecycle
- [THREAT_MODEL.md](docs/THREAT_MODEL.md) — threats, mitigations, crypto surface
- [REJECTED.md](docs/REJECTED.md) — historical context on design decisions
- [CONTRIBUTING.md](docs/CONTRIBUTING.md) — contribution guidelines

## license

MIT
