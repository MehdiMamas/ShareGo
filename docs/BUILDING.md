# building ShareGo

## prerequisites

- Node.js >= 18
- pnpm >= 10 (`corepack enable && corepack prepare pnpm@latest --activate`)
- Git

## one-command setup

the easiest way to set up your development environment:

```bash
# setup everything for your platform
./scripts/setup.sh

# or setup for a specific platform
./scripts/setup.sh ios
./scripts/setup.sh android
./scripts/setup.sh desktop
./scripts/setup.sh core
```

the script auto-detects your OS and installs all required dependencies.

## quick start (core only)

```bash
git clone https://github.com/MehdiMamas/ShareGo.git
cd ShareGo
pnpm install
pnpm run build:core
pnpm run test:core
```

## platform-specific setup

### iOS (react native bare)

> requires macOS. see [IOS_GUIDE.md](IOS_GUIDE.md) for the complete guide with troubleshooting.

**requirements:**

- macOS 13+ (Ventura or later)
- Xcode (latest from App Store)
- CocoaPods: `brew install cocoapods`
- iOS deployment target: 13.4+ (iPhone 6s and later)

**quick start:**

```bash
./scripts/setup.sh ios     # install everything
./scripts/dev-ios.sh        # run on simulator
```

**manual setup:**

```bash
# install dependencies
pnpm install
pnpm run build:core

# install iOS native deps
cd apps/app/ios
pod install
cd ..

# run on simulator
npx react-native run-ios

# run on a specific simulator
npx react-native run-ios --simulator="iPhone 15 Pro"

# run on physical device (requires code signing — see IOS_GUIDE.md)
npx react-native run-ios --device
```

**physical device setup:**

1. open `apps/app/ios/ShareGo.xcworkspace` in Xcode
2. select your Apple ID under **Signing & Capabilities > Team**
3. connect iPhone via USB, tap "Trust This Computer"
4. on iPhone: **Settings > General > VPN & Device Management** — trust developer
5. run from Xcode (⌘R) or terminal: `npx react-native run-ios --device`

a free Apple ID works for development (apps expire after 7 days).

**iOS permissions (already configured in Info.plist):**

```xml
<key>NSCameraUsageDescription</key>
<string>ShareGo needs camera access to scan QR codes for pairing</string>

<key>NSLocalNetworkUsageDescription</key>
<string>ShareGo uses local network to share data between devices on the same Wi-Fi</string>

<key>NSBonjourServices</key>
<array>
  <string>_sharego._tcp</string>
</array>
```

### android (react native bare)

**requirements:**

- [Android Studio](https://developer.android.com/studio) with Android SDK (API 34)
- JDK 17+
- `ANDROID_HOME` environment variable

**quick start:**

```bash
./scripts/setup.sh android
cd apps/app
npx react-native run-android
```

**manual setup:**

```bash
pnpm install
pnpm run build:core

cd apps/app
npx react-native run-android         # dev build on emulator/device
```

**release build:**

```bash
cd apps/app/android
./gradlew assembleRelease            # APK
./gradlew bundleRelease              # AAB (for Play Store)
```

**environment setup (macOS):**

```bash
# add to ~/.zshrc
export ANDROID_HOME=$HOME/Library/Android/sdk
export PATH=$ANDROID_HOME/platform-tools:$PATH
export PATH=$ANDROID_HOME/emulator:$PATH
```

**environment setup (linux):**

```bash
# add to ~/.bashrc
export ANDROID_HOME=$HOME/Android/Sdk
export PATH=$ANDROID_HOME/platform-tools:$PATH
export PATH=$ANDROID_HOME/emulator:$PATH
```

### desktop — Electron (windows, macOS, linux)

Electron requires only Node.js — no Rust or system webview needed.

**quick start:**

```bash
./scripts/setup.sh desktop
pnpm run dev:desktop
```

**manual setup:**

```bash
pnpm install
pnpm run build:core

# build electron main process
cd apps/app
pnpm run build:electron

# run in development
pnpm run dev:electron
```

**production build:**

```bash
# build for current platform
pnpm run build:desktop

# build with debug info
pnpm run build:desktop:debug
```

electron-builder outputs:

- **macOS:** `.dmg`, `.app` in `apps/app/release/`
- **Windows:** `.exe`, `.msi` in `apps/app/release/`
- **Linux:** `.AppImage`, `.deb` in `apps/app/release/`

## monorepo structure

this is a pnpm workspaces monorepo powered by Turborepo. the `core` package is shared between desktop and mobile. workspaces are defined in `pnpm-workspace.yaml`.

```bash
pnpm install         # installs all workspaces
turbo run build      # builds all packages (core first, then app)
pnpm run build:core  # builds core only
pnpm run test:core   # tests core only
```

## all scripts

### setup & dev

| command                   | description                         |
| ------------------------- | ----------------------------------- |
| `pnpm run setup`          | one-command setup for all platforms |
| `pnpm run setup:ios`      | setup for iOS development           |
| `pnpm run setup:android`  | setup for Android development       |
| `pnpm run setup:desktop`  | setup for desktop development       |
| `pnpm run dev:desktop`    | start desktop app in dev mode       |
| `pnpm run dev:mobile`     | start metro bundler for mobile      |
| `pnpm run dev:ios`        | run iOS app on simulator            |
| `pnpm run dev:ios:device` | run iOS app on physical iPhone      |
| `pnpm run dev:android`    | run Android app on emulator/device  |

### build

| command                        | description                     |
| ------------------------------ | ------------------------------- |
| `pnpm run build:core`          | build core library              |
| `pnpm run build:ios`           | release build for iOS (device)  |
| `pnpm run build:ios:debug`     | debug build for iOS             |
| `pnpm run build:ios:simulator` | release build for iOS simulator |
| `pnpm run build:android`       | release APK for Android         |
| `pnpm run build:android:debug` | debug APK                       |
| `pnpm run build:android:aab`   | release AAB (Play Store)        |
| `pnpm run build:desktop`       | release build for current OS    |
| `pnpm run build:desktop:debug` | debug build for current OS      |
| `pnpm run build:all`           | build core + desktop            |

### check & test

| command                  | description                      |
| ------------------------ | -------------------------------- |
| `pnpm run check`         | check all platform prerequisites |
| `pnpm run check:ios`     | check iOS prerequisites only     |
| `pnpm run check:android` | check Android prerequisites only |
| `pnpm run check:desktop` | check desktop prerequisites only |
| `pnpm run test:core`     | run core library tests           |

## checking prerequisites

before building, you can check if everything is installed:

```bash
pnpm run check             # check all platforms
pnpm run check:ios         # iOS only
pnpm run check:android     # Android only
pnpm run check:desktop     # desktop only
```

the check script reports which tools are installed and which are missing, with install instructions for each.

## environment

no `.env` files are used. ShareGo has no cloud services, no API keys, and no secrets to configure. all crypto keys are ephemeral and generated at runtime.

## build outputs

| platform        | debug  | release                |
| --------------- | ------ | ---------------------- |
| iOS (device)    | `.app` | `.app` (needs signing) |
| iOS (simulator) | `.app` | `.app`                 |
| Android         | `.apk` | `.apk` / `.aab`        |
| macOS           | binary | `.dmg`, `.app`         |
| Windows         | binary | `.msi`, `.exe`         |
| Linux           | binary | `.deb`, `.AppImage`    |
