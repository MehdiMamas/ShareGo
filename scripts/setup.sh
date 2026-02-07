#!/usr/bin/env bash
# one-command setup for ShareGo development
#
# usage:
#   ./scripts/setup.sh              # setup for all detected platforms
#   ./scripts/setup.sh ios          # setup for iOS only
#   ./scripts/setup.sh android      # setup for Android only
#   ./scripts/setup.sh desktop      # setup for desktop (Tauri) only
#   ./scripts/setup.sh core         # setup core library only
#
# this script installs dependencies, builds the core library, and runs
# platform-specific setup (pod install, etc.) so you can start developing
# immediately.

set -euo pipefail

# -- colors --
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
DIM='\033[2m'
RESET='\033[0m'

# -- helpers --
info()    { printf "${BLUE}[info]${RESET}  %s\n" "$*"; }
ok()      { printf "${GREEN}[ok]${RESET}    %s\n" "$*"; }
warn()    { printf "${YELLOW}[warn]${RESET}  %s\n" "$*"; }
err()     { printf "${RED}[err]${RESET}   %s\n" "$*"; }
step()    { printf "\n${BOLD}▸ %s${RESET}\n" "$*"; }

die() {
  printf "\n${RED}${BOLD}✗ setup failed:${RESET} %s\n\n" "$*"
  exit 1
}

success() {
  printf "\n${GREEN}${BOLD}✓ %s${RESET}\n\n" "$*"
}

has_cmd() {
  command -v "$1" &>/dev/null
}

detect_os() {
  case "$(uname -s)" in
    Darwin*)  echo "macos" ;;
    Linux*)   echo "linux" ;;
    MINGW*|MSYS*|CYGWIN*) echo "windows" ;;
    *)        echo "unknown" ;;
  esac
}

# -- resolve project root --
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# -- parse args --
TARGET="${1:-auto}"
OS=$(detect_os)

# auto-detect: on macOS, setup ios + desktop; on linux, setup android + desktop; etc.
if [ "$TARGET" = "auto" ]; then
  case "$OS" in
    macos)   TARGET="all" ;;
    linux)   TARGET="all" ;;
    windows) TARGET="all" ;;
    *)       TARGET="core" ;;
  esac
fi

printf "\n"
printf "${BOLD}${CYAN}╭───────────────────────────────────────────────╮${RESET}\n"
printf "${BOLD}${CYAN}│${RESET}  ${BOLD}ShareGo — development environment setup${RESET}      ${BOLD}${CYAN}│${RESET}\n"
printf "${BOLD}${CYAN}│${RESET}  ${DIM}target: %-38s${RESET} ${BOLD}${CYAN}│${RESET}\n" "$TARGET ($OS)"
printf "${BOLD}${CYAN}╰───────────────────────────────────────────────╯${RESET}\n"

# ================================================================
# step 1: check node.js
# ================================================================
step "checking node.js"

if ! has_cmd node; then
  err "node.js not found"
  printf "\n"
  printf "  install node.js >= 18:\n"
  printf "\n"
  case "$OS" in
    macos)
      printf "    ${BOLD}option 1 (recommended):${RESET} brew install node\n"
      printf "    ${BOLD}option 2:${RESET} download from https://nodejs.org\n"
      printf "    ${BOLD}option 3:${RESET} nvm install 20\n"
      ;;
    linux)
      printf "    ${BOLD}option 1:${RESET} curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt install -y nodejs\n"
      printf "    ${BOLD}option 2:${RESET} nvm install 20\n"
      printf "    ${BOLD}option 3:${RESET} download from https://nodejs.org\n"
      ;;
    windows)
      printf "    ${BOLD}option 1:${RESET} download from https://nodejs.org\n"
      printf "    ${BOLD}option 2:${RESET} choco install nodejs-lts\n"
      printf "    ${BOLD}option 3:${RESET} winget install OpenJS.NodeJS.LTS\n"
      ;;
  esac
  printf "\n"
  die "install node.js first, then re-run this script"
fi

NODE_VERSION=$(node -v | sed 's/^v//')
NODE_MAJOR=$(echo "$NODE_VERSION" | cut -d. -f1)
if [ "$NODE_MAJOR" -lt 18 ]; then
  die "node $NODE_VERSION is too old — need >= 18 (current LTS is 20)"
fi
ok "node $NODE_VERSION"

# ================================================================
# step 2: install npm dependencies
# ================================================================
step "installing npm dependencies"
cd "$PROJECT_ROOT"

if [ -d "node_modules" ] && [ -d "core/node_modules" ] || [ -L "core/node_modules" ]; then
  info "node_modules already exist — running npm install to sync"
fi

npm install
ok "all workspace dependencies installed"

# ================================================================
# step 3: build core library
# ================================================================
step "building @sharego/core"
cd "$PROJECT_ROOT"
npm run build:core

if [ ! -f "$PROJECT_ROOT/core/dist/index.js" ]; then
  die "core build failed — check TypeScript errors above"
fi
ok "core library built (core/dist/)"

# ================================================================
# step 4: platform-specific setup
# ================================================================

# -- ios --
setup_ios() {
  step "setting up iOS"

  if [ "$OS" != "macos" ]; then
    warn "iOS development requires macOS — skipping (detected: $OS)"
    return
  fi

  # xcode
  if ! xcode-select -p &>/dev/null; then
    info "installing xcode command line tools..."
    xcode-select --install 2>/dev/null || true
    warn "xcode CLT installer opened — finish the installation, then re-run this script"
    return
  fi
  ok "xcode command line tools installed"

  if ! has_cmd xcodebuild; then
    err "xcodebuild not found"
    printf "\n"
    printf "  you need the full Xcode app (not just command line tools):\n"
    printf "    1. open App Store → search \"Xcode\" → install\n"
    printf "    2. open Xcode once to accept the license\n"
    printf "    3. re-run this script\n"
    printf "\n"
    printf "  ${DIM}Xcode is ~12 GB, the download takes a while${RESET}\n"
    printf "\n"
    return
  fi
  ok "xcodebuild found ($(xcodebuild -version 2>/dev/null | head -1))"

  # cocoapods
  if ! has_cmd pod; then
    info "installing cocoapods..."
    if has_cmd brew; then
      brew install cocoapods
    else
      sudo gem install cocoapods
    fi
  fi

  if has_cmd pod; then
    ok "cocoapods $(pod --version 2>/dev/null)"
  else
    warn "cocoapods installation failed — install manually: brew install cocoapods"
    return
  fi

  # pod install
  IOS_DIR="$PROJECT_ROOT/apps/mobile-rn/ios"
  if [ -f "$IOS_DIR/Podfile" ]; then
    info "installing ios pods (this may take a minute on first run)..."
    cd "$IOS_DIR"
    pod install
    ok "pods installed"

    if [ -d "ShareGo.xcworkspace" ]; then
      ok "ShareGo.xcworkspace ready"
    fi
  fi

  printf "\n"
  printf "  ${BOLD}${GREEN}iOS setup complete!${RESET}\n"
  printf "\n"
  printf "  to run on simulator:\n"
  printf "    ${CYAN}cd apps/mobile-rn && npx react-native run-ios${RESET}\n"
  printf "\n"
  printf "  to run on your iPhone:\n"
  printf "    1. open ${BOLD}apps/mobile-rn/ios/ShareGo.xcworkspace${RESET} in Xcode\n"
  printf "    2. select your team in Signing & Capabilities\n"
  printf "    3. connect your iPhone via USB\n"
  printf "    4. select your device and press Run (⌘R)\n"
  printf "\n"
  printf "  ${DIM}see docs/IOS_GUIDE.md for detailed instructions${RESET}\n"
}

# -- android --
setup_android() {
  step "setting up Android"

  ANDROID_SDK="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-}}"
  if [ -z "$ANDROID_SDK" ]; then
    for candidate in \
      "$HOME/Library/Android/sdk" \
      "$HOME/Android/Sdk" \
      "/usr/local/lib/android/sdk"; do
      if [ -d "$candidate" 2>/dev/null ]; then
        ANDROID_SDK="$candidate"
        break
      fi
    done
  fi

  if [ -z "$ANDROID_SDK" ] || [ ! -d "$ANDROID_SDK" ]; then
    warn "android SDK not found"
    printf "\n"
    printf "  to set up Android development:\n"
    printf "    1. install Android Studio: https://developer.android.com/studio\n"
    printf "    2. open Android Studio → SDK Manager → install SDK (API 34)\n"
    printf "    3. set ANDROID_HOME:\n"
    case "$OS" in
      macos)
        printf "       echo 'export ANDROID_HOME=\$HOME/Library/Android/sdk' >> ~/.zshrc\n"
        printf "       echo 'export PATH=\$ANDROID_HOME/platform-tools:\$PATH' >> ~/.zshrc\n"
        ;;
      linux)
        printf "       echo 'export ANDROID_HOME=\$HOME/Android/Sdk' >> ~/.bashrc\n"
        printf "       echo 'export PATH=\$ANDROID_HOME/platform-tools:\$PATH' >> ~/.bashrc\n"
        ;;
    esac
    printf "    4. re-run this script\n"
    printf "\n"
    return
  fi

  ok "android SDK at $ANDROID_SDK"

  if has_cmd java; then
    ok "java found"
  else
    warn "java not found — install JDK 17+: brew install openjdk@17"
  fi

  ANDROID_DIR="$PROJECT_ROOT/apps/mobile-rn/android"
  if [ -f "$ANDROID_DIR/gradlew" ]; then
    ok "android project ready"
  else
    warn "android/ directory missing — it will be generated on first build"
  fi

  printf "\n"
  printf "  ${BOLD}${GREEN}Android setup complete!${RESET}\n"
  printf "\n"
  printf "  to run on emulator or device:\n"
  printf "    ${CYAN}cd apps/mobile-rn && npx react-native run-android${RESET}\n"
  printf "\n"
}

# -- desktop --
setup_desktop() {
  step "setting up desktop (Tauri)"

  if ! has_cmd rustc; then
    info "rust not found — installing via rustup..."
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
    # shellcheck disable=SC1091
    source "$HOME/.cargo/env" 2>/dev/null || true
  fi

  if has_cmd rustc; then
    ok "rust $(rustc --version | awk '{print $2}')"
  else
    warn "rust installation needs a shell restart — re-run this script after restarting your terminal"
    return
  fi

  # platform deps
  case "$OS" in
    macos)
      if ! xcode-select -p &>/dev/null; then
        xcode-select --install 2>/dev/null || true
        warn "xcode CLT installing — re-run after installation completes"
      fi
      ;;
    linux)
      if ! pkg-config --exists webkit2gtk-4.1 2>/dev/null; then
        info "installing linux dependencies..."
        if has_cmd apt; then
          sudo apt update && sudo apt install -y \
            libwebkit2gtk-4.1-dev build-essential curl wget file \
            libssl-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev
        else
          warn "please install webkit2gtk-4.1 and other tauri deps for your distro"
          warn "see: https://v2.tauri.app/start/prerequisites/#linux"
        fi
      fi
      ;;
  esac

  ok "desktop prerequisites ready"

  printf "\n"
  printf "  ${BOLD}${GREEN}Desktop setup complete!${RESET}\n"
  printf "\n"
  printf "  to start development:\n"
  printf "    ${CYAN}cd apps/desktop-tauri && npm run tauri dev${RESET}\n"
  printf "\n"
}

# -- run platform setup --
case "$TARGET" in
  core)
    # already done above
    ;;
  ios)
    setup_ios
    ;;
  android)
    setup_android
    ;;
  desktop)
    setup_desktop
    ;;
  all)
    if [ "$OS" = "macos" ]; then
      setup_ios
      setup_android
      setup_desktop
    elif [ "$OS" = "linux" ]; then
      setup_android
      setup_desktop
    elif [ "$OS" = "windows" ]; then
      setup_android
      setup_desktop
    fi
    ;;
esac

# ================================================================
# done
# ================================================================
printf "\n"
printf "${BOLD}${CYAN}╭───────────────────────────────────────────────╮${RESET}\n"
printf "${BOLD}${CYAN}│${RESET}  ${BOLD}${GREEN}setup complete${RESET}                                ${BOLD}${CYAN}│${RESET}\n"
printf "${BOLD}${CYAN}╰───────────────────────────────────────────────╯${RESET}\n"
printf "\n"
printf "  ${BOLD}useful commands:${RESET}\n"
printf "\n"
printf "    ${CYAN}npm run dev:desktop${RESET}        start desktop app in dev mode\n"
printf "    ${CYAN}npm run dev:mobile${RESET}         start metro bundler for mobile\n"
printf "    ${CYAN}npm run dev:ios${RESET}            run iOS app on simulator\n"
printf "    ${CYAN}npm run dev:android${RESET}        run Android app on emulator/device\n"
printf "    ${CYAN}npm run test:core${RESET}          run core library tests\n"
printf "    ${CYAN}npm run check${RESET}              check all prerequisites\n"
printf "    ${CYAN}npm run check:ios${RESET}          check iOS prerequisites only\n"
printf "\n"
printf "  ${DIM}for detailed guides, see docs/BUILDING.md and docs/IOS_GUIDE.md${RESET}\n"
printf "\n"
