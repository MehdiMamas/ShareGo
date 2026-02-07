#!/usr/bin/env bash
# build ShareGo desktop app (Tauri) for the current platform
#
# usage:
#   ./scripts/build-desktop.sh            # release build
#   ./scripts/build-desktop.sh --debug    # debug build
#
# outputs:
#   macos  → apps/desktop-tauri/src-tauri/target/release/bundle/dmg/
#   linux  → apps/desktop-tauri/src-tauri/target/release/bundle/deb/ (or appimage)
#   windows → apps/desktop-tauri/src-tauri/target/release/bundle/msi/ (or nsis)

source "$(dirname "$0")/preflight.sh"

MODE="release"
TAURI_FLAG=""
if [[ "${1:-}" == "--debug" ]]; then
  MODE="debug"
  TAURI_FLAG="--debug"
fi

banner "build: desktop ($MODE)"

OS=$(detect_os)

# -- preflight --
step "checking prerequisites"

check_node
check_npm
check_node_modules
require_cmd rustc "install Rust via https://rustup.rs"
require_cmd cargo "install Rust via https://rustup.rs"

# check rust version (tauri v2 needs >= 1.77.2)
if has_cmd rustc; then
  rust_version=$(rustc --version | awk '{print $2}')
  rust_major=$(echo "$rust_version" | cut -d. -f1)
  rust_minor=$(echo "$rust_version" | cut -d. -f2)
  if [ "$rust_major" -ge 1 ] && [ "$rust_minor" -ge 77 ]; then
    ok "rust $rust_version (>= 1.77 required for tauri v2)"
  else
    fail "rust $rust_version is too old — tauri v2 requires >= 1.77 (run 'rustup update')"
  fi
fi

# check tauri cli
if npx tauri --version &>/dev/null; then
  tauri_ver=$(npx tauri --version 2>/dev/null | head -1)
  ok "tauri cli found ($tauri_ver)"
else
  fail "tauri cli not found — run 'npm install' (it's in devDependencies)"
fi

# platform-specific checks
case "$OS" in
  macos)
    if xcode-select -p &>/dev/null; then
      ok "xcode command line tools installed"
    else
      fail "xcode command line tools missing — run 'xcode-select --install'"
    fi
    ;;
  linux)
    # check for webkit2gtk (required for tauri on linux)
    if pkg-config --exists webkit2gtk-4.1 2>/dev/null; then
      ok "webkit2gtk-4.1 found"
    elif pkg-config --exists webkit2gtk-4.0 2>/dev/null; then
      ok "webkit2gtk-4.0 found"
    else
      fail "webkit2gtk not found — install it:
         ubuntu/debian: sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev
         fedora:        sudo dnf install webkit2gtk4.1-devel openssl-devel curl wget file libappindicator-gtk3-devel librsvg2-devel
         arch:          sudo pacman -S webkit2gtk-4.1 base-devel curl wget file openssl appmenu-gtk-module libappindicator-gtk3 librsvg"
    fi
    # check for other common linux deps
    for dep in libssl libayatana-appindicator3 librsvg; do
      if pkg-config --exists "$dep" 2>/dev/null || pkg-config --exists "${dep}-2.0" 2>/dev/null; then
        ok "$dep found"
      else
        warn "$dep not detected (may not be required on your distro)"
      fi
    done
    ;;
  windows)
    info "windows detected — ensure WebView2 runtime is installed"
    info "download from: https://developer.microsoft.com/en-us/microsoft-edge/webview2/"
    # check for visual studio build tools
    if has_cmd cl || [ -d "/c/Program Files/Microsoft Visual Studio" ] || [ -d "/c/Program Files (x86)/Microsoft Visual Studio" ]; then
      ok "visual studio build tools likely available"
    else
      warn "could not detect visual studio build tools — you may need them for the Rust linker"
    fi
    ;;
esac

# check Cargo.toml exists
if [ -f "$PROJECT_ROOT/apps/desktop-tauri/src-tauri/Cargo.toml" ]; then
  ok "Cargo.toml found"
else
  fail "apps/desktop-tauri/src-tauri/Cargo.toml missing — project structure broken"
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

# -- build desktop --
step "building tauri desktop app ($MODE)"
cd "$PROJECT_ROOT/apps/desktop-tauri"
# tauri cli reads CI env and expects true/false, not 1/0
CI=true npx tauri build $TAURI_FLAG

# -- report output --
step "build artifacts"
TARGET_DIR="$PROJECT_ROOT/apps/desktop-tauri/src-tauri/target"
if [ "$MODE" = "debug" ]; then
  BUNDLE_DIR="$TARGET_DIR/debug/bundle"
else
  BUNDLE_DIR="$TARGET_DIR/release/bundle"
fi

if [ -d "$BUNDLE_DIR" ]; then
  info "artifacts in: $BUNDLE_DIR"
  # list actual distributable artifacts (skip helper scripts and intermediate files)
  for fmt in dmg deb appimage rpm msi nsis; do
    dir="$BUNDLE_DIR/$fmt"
    if [ -d "$dir" ]; then
      for f in "$dir"/*; do
        case "$f" in
          *.dmg|*.deb|*.AppImage|*.rpm|*.msi|*.exe) [ -f "$f" ] && ok "→ $f" ;;
        esac
      done
    fi
  done
  # show .app bundle
  if [ -d "$BUNDLE_DIR/macos" ]; then
    for f in "$BUNDLE_DIR/macos"/*.app; do
      [ -d "$f" ] && ok "→ $f"
    done
  fi
  success "desktop build complete ($MODE)"
else
  # binary-only (no bundle)
  if [ "$MODE" = "debug" ]; then
    BIN="$TARGET_DIR/debug/sharego-desktop"
  else
    BIN="$TARGET_DIR/release/sharego-desktop"
  fi
  [ -f "$BIN" ] || BIN="${BIN}.exe"
  if [ -f "$BIN" ]; then
    ok "→ $BIN"
    success "desktop build complete ($MODE) — binary only (no bundle)"
  else
    die "build finished but no artifacts found at $BUNDLE_DIR"
  fi
fi
