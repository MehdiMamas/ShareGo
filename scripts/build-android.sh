#!/usr/bin/env bash
# build ShareGo mobile app for Android
#
# usage:
#   ./scripts/build-android.sh              # release APK
#   ./scripts/build-android.sh --debug      # debug APK
#   ./scripts/build-android.sh --aab        # release AAB (for Play Store)
#
# outputs:
#   debug APK  → apps/app/android/app/build/outputs/apk/debug/
#   release APK → apps/app/android/app/build/outputs/apk/release/
#   release AAB → apps/app/android/app/build/outputs/bundle/release/

source "$(dirname "$0")/preflight.sh"

MODE="release"
BUILD_AAB=false
GRADLE_TASK="assembleRelease"

case "${1:-}" in
  --debug)
    MODE="debug"
    GRADLE_TASK="assembleDebug"
    ;;
  --aab)
    MODE="release"
    BUILD_AAB=true
    GRADLE_TASK="bundleRelease"
    ;;
esac

banner "build: android ($MODE${BUILD_AAB:+ AAB})"

MOBILE_DIR="$PROJECT_ROOT/apps/app"
ANDROID_DIR="$MOBILE_DIR/android"

# -- preflight --
step "checking prerequisites"

check_node
check_npm
check_node_modules

# java / jdk
if has_cmd java; then
  java_version=$(java -version 2>&1 | head -1)
  ok "java found ($java_version)"
else
  fail "java not found — install JDK 17+:
     macos:   brew install openjdk@17
     ubuntu:  sudo apt install openjdk-17-jdk
     windows: https://adoptium.net"
fi

if has_cmd javac; then
  ok "javac (JDK) found"
else
  fail "javac not found — you have a JRE but need a full JDK:
     macos:   brew install openjdk@17
     ubuntu:  sudo apt install openjdk-17-jdk
     windows: https://adoptium.net"
fi

# ANDROID_HOME / ANDROID_SDK_ROOT
ANDROID_SDK="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-}}"
if [ -n "$ANDROID_SDK" ] && [ -d "$ANDROID_SDK" ]; then
  ok "ANDROID_HOME=$ANDROID_SDK"
else
  # try common default locations
  for candidate in \
    "$HOME/Library/Android/sdk" \
    "$HOME/Android/Sdk" \
    "/usr/local/lib/android/sdk" \
    "$LOCALAPPDATA/Android/Sdk"; do
    if [ -d "$candidate" 2>/dev/null ]; then
      ANDROID_SDK="$candidate"
      export ANDROID_HOME="$ANDROID_SDK"
      warn "ANDROID_HOME not set — auto-detected: $ANDROID_SDK"
      break
    fi
  done
  if [ -z "$ANDROID_SDK" ]; then
    fail "ANDROID_HOME not set and SDK not found in default locations.
     set ANDROID_HOME to your Android SDK path, e.g.:
       export ANDROID_HOME=\$HOME/Library/Android/sdk   # macos
       export ANDROID_HOME=\$HOME/Android/Sdk            # linux
     or install Android Studio: https://developer.android.com/studio"
  fi
fi

# check for platform-tools (adb)
if [ -n "$ANDROID_SDK" ]; then
  if [ -x "$ANDROID_SDK/platform-tools/adb" ]; then
    adb_ver=$("$ANDROID_SDK/platform-tools/adb" version 2>/dev/null | head -1)
    ok "adb found ($adb_ver)"
  else
    fail "platform-tools not installed — open Android Studio > SDK Manager > SDK Tools and install 'Android SDK Platform-Tools'"
  fi
fi

# check android project exists
if [ -d "$ANDROID_DIR" ]; then
  ok "android project directory exists"
else
  warn "android/ directory not found — will generate it now"
fi

# check for gradlew
if [ -f "$ANDROID_DIR/gradlew" ]; then
  ok "gradlew found"
else
  if [ -d "$ANDROID_DIR" ]; then
    fail "android/gradlew missing — project may be corrupted. try removing android/ and re-running"
  fi
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

# -- generate android project if missing --
if [ ! -d "$ANDROID_DIR" ]; then
  step "generating android project"
  cd "$MOBILE_DIR"
  # react-native eject / generate android template
  if has_cmd npx; then
    npx react-native eject 2>/dev/null || true
  fi
  if [ ! -d "$ANDROID_DIR" ]; then
    die "failed to generate android/ directory. you may need to run:
     cd apps/app && npx @react-native-community/cli init --directory . --skip-install"
  fi
  ok "android project generated"
fi

# -- build android --
step "building android app ($MODE)"
cd "$ANDROID_DIR"
chmod +x gradlew 2>/dev/null || true

# set JAVA_HOME if not set (try common locations)
if [ -z "${JAVA_HOME:-}" ]; then
  if has_cmd /usr/libexec/java_home; then
    export JAVA_HOME=$(/usr/libexec/java_home 2>/dev/null || true)
  fi
fi

./gradlew "$GRADLE_TASK" --no-daemon

# -- report output --
step "build artifacts"

if [ "$BUILD_AAB" = true ]; then
  OUTPUT_DIR="$ANDROID_DIR/app/build/outputs/bundle/release"
  EXT="aab"
else
  if [ "$MODE" = "debug" ]; then
    OUTPUT_DIR="$ANDROID_DIR/app/build/outputs/apk/debug"
  else
    OUTPUT_DIR="$ANDROID_DIR/app/build/outputs/apk/release"
  fi
  EXT="apk"
fi

if [ -d "$OUTPUT_DIR" ]; then
  found=0
  for f in "$OUTPUT_DIR"/*."$EXT"; do
    [ -f "$f" ] && { ok "→ $f"; found=1; }
  done
  if [ "$found" -eq 0 ]; then
    # look for any output
    for f in "$OUTPUT_DIR"/*; do
      [ -f "$f" ] && ok "→ $f"
    done
  fi
  success "android build complete ($MODE)"
else
  die "build finished but output directory not found at $OUTPUT_DIR"
fi

if [ "$MODE" = "release" ] && [ "$BUILD_AAB" = false ]; then
  info "note: release APK needs signing before distribution."
  info "for Play Store, use --aab flag and configure signing in android/app/build.gradle"
fi
