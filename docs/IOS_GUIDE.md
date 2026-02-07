# iOS development guide

complete guide for running ShareGo on an iPhone or iOS simulator.

## requirements

| requirement | minimum | recommended |
|---|---|---|
| macOS | 13 (Ventura) | 14+ (Sonoma) |
| Xcode | 15.0 | latest from App Store |
| iOS device | iOS 13.4+ | iOS 16+ |
| CocoaPods | 1.14+ | latest |
| Node.js | 18 | 20 LTS |
| iPhone model | iPhone 6s or later | iPhone 11+ |

> **windows/linux users**: iOS development requires macOS. there is no workaround. you can still build the Android and desktop versions on any OS.

## quick start (one command)

if you just want to get running as fast as possible:

```bash
# first time setup — installs everything
./scripts/setup.sh ios

# run on simulator
./scripts/dev-ios.sh

# run on your iPhone
./scripts/dev-ios.sh --device
```

that's it. the scripts handle dependencies, building, and pod installation automatically.

## step-by-step setup

if you prefer to understand each step, or if the quick start didn't work:

### 1. install Xcode

Xcode is required for all iOS development. it includes the compiler, simulator, and signing tools.

```bash
# check if already installed
xcodebuild -version
```

if not installed:
1. open the **App Store** on your Mac
2. search for **Xcode**
3. click **Get** / **Install** (~12 GB download — grab a coffee)
4. once installed, **open Xcode once** to accept the license agreement
5. it will install additional components — let it finish

verify:
```bash
xcodebuild -version
# should print something like: Xcode 16.2 Build version 16C5032a
```

### 2. install Xcode command line tools

```bash
xcode-select --install
```

if you get "already installed", you're good.

### 3. install CocoaPods

CocoaPods manages native iOS dependencies (libsodium, camera, networking modules).

```bash
# option 1: homebrew (recommended — avoids ruby permission issues)
brew install cocoapods

# option 2: rubygems
sudo gem install cocoapods
```

verify:
```bash
pod --version
# should print 1.14+ or higher
```

> **troubleshooting**: if `gem install cocoapods` fails with permission errors, use homebrew instead. if you don't have homebrew: https://brew.sh

### 4. install project dependencies

from the project root:

```bash
# install all workspace dependencies
npm install

# build the shared core library
npm run build:core
```

### 5. install iOS pods

```bash
cd apps/mobile-rn/ios
pod install
cd ..
```

this creates `ShareGo.xcworkspace` which includes all native module configurations.

> **important**: always open the `.xcworkspace` file, not the `.xcodeproj`. the workspace includes CocoaPods configuration.

### 6. run on simulator

```bash
cd apps/mobile-rn
npx react-native run-ios
```

this will:
- start the Metro bundler (JS dev server)
- compile the native iOS app
- boot an iOS simulator
- install and launch the app

first build takes 3-5 minutes. subsequent builds are much faster.

### 7. run on a physical iPhone

running on a real device requires code signing. here's how:

#### a. set up code signing in Xcode

1. open `apps/mobile-rn/ios/ShareGo.xcworkspace` in Xcode
2. in the project navigator (left sidebar), click on **ShareGo** (the blue icon at the top)
3. select the **ShareGo** target
4. go to the **Signing & Capabilities** tab
5. check **Automatically manage signing**
6. under **Team**, select your Apple ID
   - if you don't have one listed, click **Add Account...** and sign in with your Apple ID
   - a **free Apple ID** works for development — you don't need a paid developer account
7. Xcode will automatically create a provisioning profile

> **note**: with a free Apple ID, apps expire after 7 days and you can only have 3 apps installed at once. a paid developer account ($99/year) removes these limits. see the [app expiration](#app-expiration--re-signing) section below for details.

#### b. connect your iPhone

1. connect your iPhone to your Mac via **USB cable** (Lightning or USB-C)
2. if prompted on your iPhone, tap **Trust This Computer**
3. if prompted to enter your passcode, do so

#### c. trust the developer on your iPhone

the first time you run a development app, iOS will block it. you need to trust the developer certificate:

1. on your iPhone, go to **Settings** > **General** > **VPN & Device Management**
   - on older iOS versions: **Settings** > **General** > **Profiles & Device Management**
2. find your Apple ID under **Developer App**
3. tap it, then tap **Trust "[your email]"**
4. confirm by tapping **Trust**

#### d. run the app

from terminal:
```bash
cd apps/mobile-rn
npx react-native run-ios --device
```

or from Xcode:
1. select your iPhone from the device dropdown (top of Xcode window)
2. press **Run** (⌘R)

#### e. allow local network access

when ShareGo launches for the first time, iOS will show a permission dialog:

> "ShareGo" would like to find and connect to devices on your local network.

**tap Allow** — this is required for ShareGo to work. the app communicates over local Wi-Fi only, never over the internet.

## iOS permissions explained

ShareGo requests these permissions — all are required for the app to function:

| permission | why | when prompted |
|---|---|---|
| **Camera** | scan QR codes to pair with another device | first time you tap "Scan QR" |
| **Local Network** | communicate with the other device on your Wi-Fi | first app launch |

no data ever leaves your local network. see [THREAT_MODEL.md](THREAT_MODEL.md) for details.

## running on a specific simulator

```bash
# list available simulators
xcrun simctl list devices available

# run on a specific simulator
npx react-native run-ios --simulator="iPhone 15 Pro"
npx react-native run-ios --simulator="iPhone SE (3rd generation)"
```

## troubleshooting

### "No bundle URL present"

the Metro bundler isn't running or can't connect.

```bash
# start metro manually in a separate terminal
cd apps/mobile-rn
npx react-native start --reset-cache

# then in another terminal
npx react-native run-ios
```

### "Unable to boot device in current state: Booted"

the simulator is already running. just rebuild:

```bash
npx react-native run-ios
```

### pod install fails

```bash
cd apps/mobile-rn/ios

# clear caches and retry
pod deintegrate
pod cache clean --all
rm -rf Pods Podfile.lock
pod install
```

if you see ruby/gem errors:
```bash
# use homebrew cocoapods instead
brew install cocoapods
pod install
```

### build fails with signing errors

1. open `ShareGo.xcworkspace` in Xcode
2. go to **Signing & Capabilities**
3. make sure a team is selected
4. try changing the **Bundle Identifier** to something unique:
   - e.g., `com.yourname.sharego`
5. clean build: **Product > Clean Build Folder** (⇧⌘K)
6. rebuild

### "Could not find iPhone" when running --device

1. make sure your iPhone is connected via USB (not just Wi-Fi)
2. make sure you've tapped "Trust This Computer" on your iPhone
3. try: `npx react-native run-ios --device "YourPhoneName"`
   - find your phone name in **Settings > General > About > Name**

### app crashes on launch

```bash
# check logs
npx react-native log-ios

# or use Xcode:
# 1. run from Xcode (⌘R)
# 2. check the debug console at the bottom
```

### slow first build

the first build compiles all native modules (~3-5 minutes). this is normal.
subsequent builds reuse the cache and are much faster (~15-30 seconds).

to speed up builds:
- close other heavy apps (Xcode is memory-hungry)
- use `ccache` (uncomment in Podfile's `post_install`)
- run `npx react-native run-ios --mode Release` for a faster app (but no hot reload)

### metro bundler port conflict

if port 8081 is in use:

```bash
# find what's using port 8081
lsof -i :8081

# start metro on a different port
npx react-native start --port 8082

# run with the custom port
npx react-native run-ios --port 8082
```

## supported iOS versions

ShareGo supports **iOS 13.4 and later**, which covers:

| device | iOS support |
|---|---|
| iPhone 15 / 15 Pro / 15 Pro Max | ✓ |
| iPhone 14 / 14 Pro / 14 Pro Max | ✓ |
| iPhone 13 / 13 Pro / 13 Pro Max / 13 mini | ✓ |
| iPhone 12 / 12 Pro / 12 Pro Max / 12 mini | ✓ |
| iPhone 11 / 11 Pro / 11 Pro Max | ✓ |
| iPhone XS / XS Max / XR | ✓ |
| iPhone X | ✓ |
| iPhone 8 / 8 Plus | ✓ |
| iPhone 7 / 7 Plus | ✓ |
| iPhone SE (1st, 2nd, 3rd gen) | ✓ |
| iPhone 6s / 6s Plus | ✓ |

> iPhone 6 and earlier are **not supported** (they can't run iOS 13).

## app expiration & re-signing

### free Apple ID (no developer account)

| | detail |
|---|---|
| **app lifetime** | 7 days from install |
| **max apps** | 3 sideloaded apps at a time |
| **what happens at expiry** | app icon stays but won't launch |
| **how to fix** | re-run from Xcode or `npm run dev:ios:device` (~15-30 seconds) |
| **cost** | free |

after 7 days, you just need to reconnect your phone to your Mac and re-deploy. the build is cached so it's fast. since ShareGo uses ephemeral sessions with no persistent data, expiration has no practical impact — you just need to re-deploy to keep using the app.

### paid Apple Developer account ($99/year)

| | detail |
|---|---|
| **app lifetime** | 365 days from install |
| **max apps** | unlimited |
| **other benefits** | TestFlight distribution, App Store publishing, push notifications |
| **cost** | $99/year |

for personal use, the free account works fine — you just need to re-deploy once a week if you use the app regularly.

### re-signing steps

when your app expires:

1. connect your iPhone to your Mac via USB
2. run `npm run dev:ios:device` (or press Run in Xcode)
3. the app is re-installed and re-signed automatically
4. done — the 7-day timer resets

## development tips

### hot reload

when running in debug mode, changes to JavaScript/TypeScript files are applied instantly without rebuilding. just save the file and the app updates.

### debugging

- **shake your iPhone** (or press ⌘D in simulator) to open the React Native debug menu
- enable **Fast Refresh** for instant UI updates
- use **React DevTools** for component inspection

### both devices on the same Wi-Fi

to test ShareGo properly, you need two devices on the same Wi-Fi network:

- **option 1**: iPhone + Mac (run desktop app on Mac, mobile app on iPhone)
- **option 2**: iPhone + Android (run mobile app on both)
- **option 3**: iPhone + iOS simulator (both use your Mac's network — works for testing)
- **option 4**: two iPhones (if you have a second device)

### building a release

```bash
# from project root
npm run build:ios              # release build for device
npm run build:ios:simulator    # release build for simulator
npm run build:ios:debug        # debug build for device
```

or use the build script directly:
```bash
./scripts/build-ios.sh --debug --simulator
```
