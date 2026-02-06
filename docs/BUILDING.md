# Building ShareGo

## Prerequisites

- Node.js >= 18
- npm >= 9
- Git

## Quick start (core only)

```bash
# clone and install
git clone <repo-url> ShareGo
cd ShareGo
npm install

# type check
cd core
npx tsc --noEmit

# run tests
npm test

# build
npm run build
```

## Platform-specific setup

### Desktop — Tauri (Windows, macOS, Linux)

Tauri requires Rust and platform-specific system dependencies.

#### All desktop platforms

```bash
# install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

#### Windows

- Install [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) (MSVC workload)
- WebView2 is included in Windows 10/11
- Install [Node.js LTS](https://nodejs.org/)

```bash
cd apps/desktop-tauri
npm install
npm run tauri dev    # development
npm run tauri build  # production (outputs .msi / .exe)
```

#### macOS

- Install Xcode Command Line Tools: `xcode-select --install`
- WebKit is system-provided (WKWebView)

```bash
cd apps/desktop-tauri
npm install
npm run tauri dev    # development
npm run tauri build  # production (outputs .dmg / .app)
```

For universal binary (x64 + ARM):
```bash
rustup target add aarch64-apple-darwin x86_64-apple-darwin
npm run tauri build -- --target universal-apple-darwin
```

#### Linux

Install system dependencies (Ubuntu/Debian):
```bash
sudo apt update
sudo apt install -y \
  libwebkit2gtk-4.1-dev \
  build-essential \
  curl \
  wget \
  file \
  libssl-dev \
  libgtk-3-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev
```

```bash
cd apps/desktop-tauri
npm install
npm run tauri dev    # development
npm run tauri build  # production (outputs .deb / .AppImage)
```

### Mobile — React Native bare (Android, iOS)

#### Android

- Install [Android Studio](https://developer.android.com/studio)
- Install Android SDK (API 33+)
- Set `ANDROID_HOME` environment variable
- Install JDK 17+

```bash
cd apps/mobile-rn
npm install

# run on connected device or emulator
npx react-native run-android

# build release APK
cd android
./gradlew assembleRelease
```

#### iOS

- Install Xcode (latest from Mac App Store)
- Install CocoaPods: `sudo gem install cocoapods`
- iOS 14+ deployment target (for local network permission)

```bash
cd apps/mobile-rn
npm install
cd ios && pod install && cd ..

# run on simulator
npx react-native run-ios

# build for device
npx react-native run-ios --device
```

iOS-specific permissions (add to `Info.plist`):
```xml
<key>NSCameraUsageDescription</key>
<string>ShareGo needs camera access to scan QR codes for secure pairing</string>

<key>NSLocalNetworkUsageDescription</key>
<string>ShareGo needs local network access to securely share data with nearby devices</string>

<key>NSBonjourServices</key>
<array>
  <string>_sharego._tcp</string>
</array>
```

## Monorepo structure

This is an npm workspaces monorepo. The `core` package is shared between desktop and mobile apps.

```
npm install          # installs all workspaces
npm run build:core   # builds core only
npm run test:core    # tests core only
```

## Environment

No `.env` files are used. ShareGo has no cloud services, no API keys, and no secrets to configure. All crypto keys are ephemeral and generated at runtime.
