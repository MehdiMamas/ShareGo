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
check_npm
check_node_modules
check_core_built

# ---------- desktop ----------
if [ "$TARGET" = "all" ] || [ "$TARGET" = "desktop" ]; then
  step "desktop (tauri) prerequisites"
  require_cmd rustc "install via https://rustup.rs"
  require_cmd cargo "install via https://rustup.rs"

  if has_cmd rustc; then
    rust_version=$(rustc --version | awk '{print $2}')
    rust_minor=$(echo "$rust_version" | cut -d. -f2)
    if [ "$rust_minor" -ge 77 ]; then
      ok "rust $rust_version (>= 1.77 required)"
    else
      fail "rust $rust_version too old — need >= 1.77 (run 'rustup update')"
    fi
  fi

  if npx tauri --version &>/dev/null; then
    ok "tauri cli found ($(npx tauri --version 2>/dev/null | head -1))"
  else
    fail "tauri cli not found — run 'npm install'"
  fi

  if [ -f "$PROJECT_ROOT/apps/desktop-tauri/src-tauri/Cargo.toml" ]; then
    ok "Cargo.toml found"
  else
    fail "Cargo.toml missing"
  fi

  case "$OS" in
    macos)
      if xcode-select -p &>/dev/null; then ok "xcode CLT installed"; else fail "xcode CLT missing — run 'xcode-select --install'"; fi
      ;;
    linux)
      if pkg-config --exists webkit2gtk-4.1 2>/dev/null || pkg-config --exists webkit2gtk-4.0 2>/dev/null; then
        ok "webkit2gtk found"
      else
        fail "webkit2gtk missing — see https://v2.tauri.app/start/prerequisites/#linux"
      fi
      ;;
    windows)
      info "ensure WebView2 and VS Build Tools are installed"
      ;;
  esac
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

  if [ -d "$PROJECT_ROOT/apps/mobile-rn/android" ]; then
    ok "android/ project exists"
    [ -f "$PROJECT_ROOT/apps/mobile-rn/android/gradlew" ] && ok "gradlew found" || fail "gradlew missing"
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

    [ -f "$PROJECT_ROOT/apps/mobile-rn/ios/ShareGo.xcodeproj/project.pbxproj" ] && ok "xcodeproj found" || fail "xcodeproj missing"
    [ -f "$PROJECT_ROOT/apps/mobile-rn/ios/Podfile" ] && ok "Podfile found" || fail "Podfile missing"
  fi
fi

# ---------- summary ----------
printf "\n"
if [ "$PREFLIGHT_ERRORS" -gt 0 ]; then
  die "$PREFLIGHT_ERRORS issue(s) found — fix them before building"
else
  success "all $TARGET prerequisites satisfied — ready to build"
fi
