# building ShareGo

## prerequisites

- Node.js >= 18
- npm >= 9
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
npm install
npm run build:core
npm run test:core
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
npm install
npm run build:core

# install iOS native deps
cd apps/mobile-rn/ios
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
1. open `apps/mobile-rn/ios/ShareGo.xcworkspace` in Xcode
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
cd apps/mobile-rn
npx react-native run-android
```

**manual setup:**
```bash
npm install
npm run build:core

cd apps/mobile-rn
npx react-native run-android         # dev build on emulator/device
```

**release build:**
```bash
cd apps/mobile-rn/android
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

### desktop — Tauri (windows, macOS, linux)

Tauri requires Rust and platform-specific system dependencies.

**all desktop platforms:**
```bash
# install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

or use the setup script:
```bash
./scripts/setup.sh desktop
```

#### windows

- install [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) (MSVC workload)
- WebView2 is included in Windows 10/11
- install [Node.js LTS](https://nodejs.org/)

```bash
cd apps/desktop-tauri
npm install
npm run tauri dev    # development
npm run tauri build  # production (outputs .msi / .exe)
```

#### macOS

- install Xcode Command Line Tools: `xcode-select --install`
- WebKit is system-provided (WKWebView)

```bash
cd apps/desktop-tauri
npm install
npm run tauri dev    # development
npm run tauri build  # production (outputs .dmg / .app)
```

for universal binary (x64 + ARM):
```bash
rustup target add aarch64-apple-darwin x86_64-apple-darwin
npm run tauri build -- --target universal-apple-darwin
```

#### linux

install system dependencies:

**ubuntu/debian:**
```bash
sudo apt update
sudo apt install -y \
  libwebkit2gtk-4.1-dev \
  build-essential \
  curl wget file \
  libssl-dev \
  libgtk-3-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev
```

**fedora:**
```bash
sudo dnf install webkit2gtk4.1-devel openssl-devel curl wget file \
  libappindicator-gtk3-devel librsvg2-devel
```

**arch:**
```bash
sudo pacman -S webkit2gtk-4.1 base-devel curl wget file openssl \
  appmenu-gtk-module libappindicator-gtk3 librsvg
```

```bash
cd apps/desktop-tauri
npm install
npm run tauri dev    # development
npm run tauri build  # production (outputs .deb / .AppImage)
```

## monorepo structure

this is an npm workspaces monorepo. the `core` package is shared between desktop and mobile apps.

```bash
npm install          # installs all workspaces
npm run build:core   # builds core only
npm run test:core    # tests core only
```

## all scripts

### setup & dev

| command | description |
|---|---|
| `npm run setup` | one-command setup for all platforms |
| `npm run setup:ios` | setup for iOS development |
| `npm run setup:android` | setup for Android development |
| `npm run setup:desktop` | setup for desktop development |
| `npm run dev:desktop` | start desktop app in dev mode |
| `npm run dev:mobile` | start metro bundler for mobile |
| `npm run dev:ios` | run iOS app on simulator |
| `npm run dev:ios:device` | run iOS app on physical iPhone |
| `npm run dev:android` | run Android app on emulator/device |

### build

| command | description |
|---|---|
| `npm run build:core` | build core library |
| `npm run build:ios` | release build for iOS (device) |
| `npm run build:ios:debug` | debug build for iOS |
| `npm run build:ios:simulator` | release build for iOS simulator |
| `npm run build:android` | release APK for Android |
| `npm run build:android:debug` | debug APK |
| `npm run build:android:aab` | release AAB (Play Store) |
| `npm run build:desktop` | release build for current OS |
| `npm run build:desktop:debug` | debug build for current OS |
| `npm run build:all` | build core + desktop |

### check & test

| command | description |
|---|---|
| `npm run check` | check all platform prerequisites |
| `npm run check:ios` | check iOS prerequisites only |
| `npm run check:android` | check Android prerequisites only |
| `npm run check:desktop` | check desktop prerequisites only |
| `npm run test:core` | run core library tests |

## checking prerequisites

before building, you can check if everything is installed:

```bash
npm run check              # check all platforms
npm run check:ios          # iOS only
npm run check:android      # Android only
npm run check:desktop      # desktop only
```

the check script reports which tools are installed and which are missing, with install instructions for each.

## environment

no `.env` files are used. ShareGo has no cloud services, no API keys, and no secrets to configure. all crypto keys are ephemeral and generated at runtime.

## build outputs

| platform | debug | release |
|---|---|---|
| iOS (device) | `.app` | `.app` (needs signing) |
| iOS (simulator) | `.app` | `.app` |
| Android | `.apk` | `.apk` / `.aab` |
| macOS | binary | `.dmg`, `.app` |
| Windows | binary | `.msi`, `.exe` |
| Linux | binary | `.deb`, `.AppImage` |
