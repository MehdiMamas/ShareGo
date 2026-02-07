# build instructions

## prerequisites

- node.js >= 18
- npm >= 9

## core library

```bash
npm install
npm run build:core
```

## desktop (tauri v2)

requires rust toolchain:

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
cargo install tauri-cli --version "^2.0"
```

platform-specific deps:
- **windows**: visual studio build tools (MSVC workload)
- **macOS**: `xcode-select --install`
- **linux**: `sudo apt install libwebkit2gtk-4.1-dev build-essential libssl-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev`

```bash
cd apps/desktop-tauri
npm install
npm run tauri dev      # development
npm run tauri build    # production
```

build outputs:
- windows: `.msi`, `.exe`
- macOS: `.dmg`, `.app`
- linux: `.deb`, `.AppImage`

## mobile (react native bare)

### android

requires android studio, android SDK (API 33+), JDK 17+.

```bash
cd apps/mobile-rn
npm install
npx react-native run-android         # dev
cd android && ./gradlew assembleRelease   # release APK
```

### iOS

requires xcode, cocoapods (`gem install cocoapods`).

```bash
cd apps/mobile-rn
npm install
cd ios && pod install && cd ..
npx react-native run-ios             # simulator
npx react-native run-ios --device    # device
```

add to `Info.plist`:

```xml
<key>NSCameraUsageDescription</key>
<string>ShareGo needs camera access to scan QR codes for secure pairing</string>

<key>NSLocalNetworkUsageDescription</key>
<string>ShareGo needs local network access to securely share data with nearby devices</string>
```

## monorepo

```bash
npm install          # install all workspaces
npm run build:core   # build core only
npm run test:core    # test core only
```

no `.env` files. no API keys. no cloud services. all crypto keys are ephemeral and generated at runtime.

for detailed platform-specific setup, see [docs/BUILDING.md](docs/BUILDING.md).
