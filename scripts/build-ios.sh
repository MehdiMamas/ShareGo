#!/usr/bin/env bash
# build ShareGo mobile app for iOS
#
# usage:
#   ./scripts/build-ios.sh                        # release build (device)
#   ./scripts/build-ios.sh --debug                 # debug build (device)
#   ./scripts/build-ios.sh --simulator             # release build (simulator)
#   ./scripts/build-ios.sh --debug --simulator     # debug build (simulator)
#
# outputs:
#   apps/app/ios/build/Build/Products/{Release,Debug}-{iphoneos,iphonesimulator}/ShareGo.app

source "$(dirname "$0")/preflight.sh"

OS=$(detect_os)
if [ "$OS" != "macos" ]; then
  die "iOS builds require macOS — detected: $OS"
fi

MODE="Release"
DESTINATION="generic/platform=iOS"
SDK_LABEL="device"

for arg in "$@"; do
  case "$arg" in
    --debug)
      MODE="Debug"
      ;;
    --simulator)
      DESTINATION="generic/platform=iOS Simulator"
      SDK_LABEL="simulator"
      ;;
  esac
done

banner "build: iOS ($MODE, $SDK_LABEL)"

MOBILE_DIR="$PROJECT_ROOT/apps/app"
IOS_DIR="$MOBILE_DIR/ios"

# -- preflight --
step "checking prerequisites"

check_node
check_npm
check_node_modules

# xcode
if xcode-select -p &>/dev/null; then
  ok "xcode command line tools installed"
else
  fail "xcode command line tools missing — run 'xcode-select --install'"
fi

if has_cmd xcodebuild; then
  xc_version=$(xcodebuild -version 2>/dev/null | head -1)
  ok "xcodebuild found ($xc_version)"
else
  fail "xcodebuild not found — install Xcode from the App Store (https://apps.apple.com/app/xcode/id497799835)"
fi

# cocoapods
if has_cmd pod; then
  pod_version=$(pod --version 2>/dev/null)
  ok "cocoapods found ($pod_version)"
else
  fail "cocoapods not found — install it:
     sudo gem install cocoapods
     or: brew install cocoapods"
fi

# ios project exists
if [ -f "$IOS_DIR/ShareGo.xcodeproj/project.pbxproj" ]; then
  ok "ios xcodeproj found"
else
  fail "ios/ShareGo.xcodeproj missing — project structure broken"
fi

# Podfile
if [ -f "$IOS_DIR/Podfile" ]; then
  ok "Podfile found"
else
  fail "ios/Podfile missing — project structure broken"
fi

assert_preflight

# -- build core first --
step "building core library"
cd "$PROJECT_ROOT"
npm run build:core
if [ ! -f "$PROJECT_ROOT/core/dist/index.js" ]; then
  die "core build failed — fix TypeScript errors above"
fi
ok "core built"

# -- run tests --
step "running core tests"
npm run test:core
ok "all tests passed"

# -- install pods --
step "installing cocoapods dependencies"
cd "$IOS_DIR"

if [ -f "Podfile.lock" ] && [ -d "Pods" ]; then
  info "pods already installed — running pod install to sync"
fi

pod install --repo-update
if [ ! -d "ShareGo.xcworkspace" ]; then
  die "pod install failed — no .xcworkspace generated"
fi
ok "pods installed"

# -- bundle js --
step "bundling javascript"
cd "$MOBILE_DIR"

BUNDLE_OUTPUT="$IOS_DIR/build/Build/Products/$MODE-iphoneos/main.jsbundle"
if [ "$SDK_LABEL" = "simulator" ]; then
  BUNDLE_OUTPUT="$IOS_DIR/build/Build/Products/$MODE-iphonesimulator/main.jsbundle"
fi

# react-native bundle for release builds
if [ "$MODE" = "Release" ]; then
  npx react-native bundle \
    --entry-file index.js \
    --platform ios \
    --dev false \
    --bundle-output "$IOS_DIR/main.jsbundle" \
    --assets-dest "$IOS_DIR"
  ok "js bundle created"
else
  info "debug mode — js will be served from metro bundler"
fi

# -- build ios --
step "building iOS app ($MODE, $SDK_LABEL)"
cd "$IOS_DIR"

xcodebuild \
  -workspace ShareGo.xcworkspace \
  -scheme ShareGo \
  -configuration "$MODE" \
  -destination "$DESTINATION" \
  -derivedDataPath build \
  CODE_SIGNING_ALLOWED=NO \
  clean build \
  | tail -20

# -- report output --
step "build artifacts"

if [ "$SDK_LABEL" = "simulator" ]; then
  APP_DIR="$IOS_DIR/build/Build/Products/$MODE-iphonesimulator"
else
  APP_DIR="$IOS_DIR/build/Build/Products/$MODE-iphoneos"
fi

if [ -d "$APP_DIR/ShareGo.app" ]; then
  ok "→ $APP_DIR/ShareGo.app"
  # check for dSYM
  if [ -d "$APP_DIR/ShareGo.app.dSYM" ]; then
    ok "→ $APP_DIR/ShareGo.app.dSYM (debug symbols)"
  fi
  success "iOS build complete ($MODE, $SDK_LABEL)"
else
  # check alternate paths
  found=false
  for d in "$IOS_DIR/build/Build/Products"/*; do
    if [ -d "$d/ShareGo.app" ]; then
      ok "→ $d/ShareGo.app"
      found=true
    fi
  done
  if [ "$found" = false ]; then
    die "build finished but ShareGo.app not found — check xcodebuild output above"
  fi
  success "iOS build complete ($MODE)"
fi

if [ "$MODE" = "Release" ] && [ "$SDK_LABEL" != "simulator" ]; then
  info "note: release .app needs code signing and provisioning for device installation."
  info "for App Store distribution, archive via Xcode or use xcodebuild archive."
fi
