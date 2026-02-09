#!/usr/bin/env bash
# check prerequisites for one or all platforms (no build)
#
# usage:
#   ./scripts/check.sh              # check all platforms
#   ./scripts/check.sh desktop      # desktop only
#   ./scripts/check.sh android      # android only
#   ./scripts/check.sh ios          # ios only

source "$(dirname "$0")/preflight.sh"

TARGET="${1:-all}"
OS=$(detect_os)

banner "prerequisite check ($TARGET)"

# ---------- common ----------
step "common prerequisites"
check_node
check_pnpm
check_node_modules
check_core_built

# ---------- desktop ----------
if [ "$TARGET" = "all" ] || [ "$TARGET" = "desktop" ]; then
  step "desktop (electron) prerequisites"

  # electron only needs node.js — already checked in common
  ok "node.js is sufficient for Electron"

  # check electron is installed
  if [ -d "$PROJECT_ROOT/apps/app/node_modules/electron" ] || [ -d "$PROJECT_ROOT/node_modules/electron" ]; then
    ok "electron package installed"
  else
    fail "electron not installed — run 'pnpm install'"
  fi

  # check electron main process compiles
  if [ -f "$PROJECT_ROOT/apps/app/dist-electron/main.js" ]; then
    ok "electron main process built"
  else
    warn "electron main process not built — run 'pnpm run build:electron' in apps/app"
  fi
fi

# ---------- android ----------
if [ "$TARGET" = "all" ] || [ "$TARGET" = "android" ]; then
  step "android prerequisites"
  if has_cmd java; then
    ok "java found ($(java -version 2>&1 | head -1))"
  else
    fail "java not found — install JDK 17+"
  fi

  if has_cmd javac; then
    ok "javac (JDK) found"
  else
    fail "javac missing — need full JDK, not just JRE"
  fi

  ANDROID_SDK="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-}}"
  if [ -z "$ANDROID_SDK" ]; then
    for candidate in "$HOME/Library/Android/sdk" "$HOME/Android/Sdk" "/usr/local/lib/android/sdk"; do
      [ -d "$candidate" ] && ANDROID_SDK="$candidate" && break
    done
  fi

  if [ -n "$ANDROID_SDK" ] && [ -d "$ANDROID_SDK" ]; then
    ok "android SDK at $ANDROID_SDK"
    [ -x "$ANDROID_SDK/platform-tools/adb" ] && ok "adb found" || fail "platform-tools missing"
  else
    fail "android SDK not found — set ANDROID_HOME or install Android Studio"
  fi

  if [ -d "$PROJECT_ROOT/apps/app/android" ]; then
    ok "android/ project exists"
    [ -f "$PROJECT_ROOT/apps/app/android/gradlew" ] && ok "gradlew found" || fail "gradlew missing"
  else
    warn "android/ directory doesn't exist yet — will be generated on first build"
  fi
fi

# ---------- ios ----------
if [ "$TARGET" = "all" ] || [ "$TARGET" = "ios" ]; then
  step "iOS prerequisites"

  if [ "$OS" != "macos" ]; then
    fail "iOS builds require macOS — current OS: $OS"
  else
    if xcode-select -p &>/dev/null; then ok "xcode CLT installed"; else fail "xcode CLT missing"; fi
    if has_cmd xcodebuild; then
      ok "xcodebuild found ($(xcodebuild -version 2>/dev/null | head -1))"
    else
      fail "xcodebuild not found — install Xcode from App Store"
    fi
    if has_cmd pod; then
      ok "cocoapods found ($(pod --version 2>/dev/null))"
    else
      fail "cocoapods missing — run 'sudo gem install cocoapods' or 'brew install cocoapods'"
    fi

    [ -f "$PROJECT_ROOT/apps/app/ios/ShareGo.xcodeproj/project.pbxproj" ] && ok "xcodeproj found" || fail "xcodeproj missing"
    [ -f "$PROJECT_ROOT/apps/app/ios/Podfile" ] && ok "Podfile found" || fail "Podfile missing"
  fi
fi

# ---------- summary ----------
printf "\n"
if [ "$PREFLIGHT_ERRORS" -gt 0 ]; then
  die "$PREFLIGHT_ERRORS issue(s) found — fix them before building"
else
  success "all $TARGET prerequisites satisfied — ready to build"
fi
