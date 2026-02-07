# build instructions

## one-command setup

```bash
./scripts/setup.sh           # auto-detect platform, install everything
./scripts/setup.sh ios       # iOS only
./scripts/setup.sh android   # Android only
./scripts/setup.sh desktop   # desktop only
```

or via npm:

```bash
npm run setup                # same as ./scripts/setup.sh
npm run setup:ios            # iOS only
npm run setup:android        # Android only
npm run setup:desktop        # desktop only
```

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
```

platform-specific deps:
- **windows**: visual studio build tools (MSVC workload)
- **macOS**: `xcode-select --install`
- **linux**: `sudo apt install libwebkit2gtk-4.1-dev build-essential libssl-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev`

```bash
npm run dev:desktop            # development
npm run build:desktop          # production
```

build outputs:
- windows: `.msi`, `.exe`
- macOS: `.dmg`, `.app`
- linux: `.deb`, `.AppImage`

## mobile (react native bare)

### iOS

requires macOS, xcode, cocoapods (`brew install cocoapods`).
minimum iOS version: **13.4** (iPhone 6s and later).

```bash
# one-command setup + run
npm run setup:ios              # install everything
npm run dev:ios                # run on simulator
npm run dev:ios:device         # run on physical iPhone
```

manual steps:
```bash
cd apps/mobile-rn
npm install
cd ios && pod install && cd ..
npx react-native run-ios             # simulator
npx react-native run-ios --device    # device (requires code signing)
```

for physical device setup (code signing, trusting developer), see [docs/IOS_GUIDE.md](docs/IOS_GUIDE.md).

### android

requires android studio, android SDK (API 34), JDK 17+.

```bash
npm run setup:android          # check prerequisites
npm run dev:android            # run on emulator/device
```

manual steps:
```bash
cd apps/mobile-rn
npm install
npx react-native run-android         # dev
cd android && ./gradlew assembleRelease   # release APK
```

## monorepo

```bash
npm install          # install all workspaces
npm run build:core   # build core only
npm run test:core    # test core only
npm run check        # check all prerequisites
npm run check:ios    # check iOS prerequisites
```

no `.env` files. no API keys. no cloud services. all crypto keys are ephemeral and generated at runtime.

for detailed platform-specific setup, see [docs/BUILDING.md](docs/BUILDING.md).
for iOS-specific guide, see [docs/IOS_GUIDE.md](docs/IOS_GUIDE.md).
