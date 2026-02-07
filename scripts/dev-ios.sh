#!/usr/bin/env bash
# start iOS development in one command
#
# usage:
#   ./scripts/dev-ios.sh                    # run on simulator (default)
#   ./scripts/dev-ios.sh --device           # run on connected iPhone
#   ./scripts/dev-ios.sh --device "iPhone"  # run on specific device
#   ./scripts/dev-ios.sh --setup            # just setup, don't run
#
# this script handles everything:
#   1. checks prerequisites (xcode, cocoapods)
#   2. builds core if needed
#   3. installs pods if needed
#   4. starts metro + runs the app

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

info()  { printf "${BLUE}[info]${RESET}  %s\n" "$*"; }
ok()    { printf "${GREEN}[ok]${RESET}    %s\n" "$*"; }
warn()  { printf "${YELLOW}[warn]${RESET}  %s\n" "$*"; }
step()  { printf "\n${BOLD}▸ %s${RESET}\n" "$*"; }

die() {
  printf "\n${RED}${BOLD}✗ %s${RESET}\n\n" "$*"
  exit 1
}

has_cmd() {
  command -v "$1" &>/dev/null
}

# -- resolve paths --
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
MOBILE_DIR="$PROJECT_ROOT/apps/mobile-rn"
IOS_DIR="$MOBILE_DIR/ios"

# -- check macOS --
if [ "$(uname -s)" != "Darwin" ]; then
  die "iOS development requires macOS"
fi

# -- parse args --
RUN_ON_DEVICE=false
DEVICE_NAME=""
SETUP_ONLY=false

for arg in "$@"; do
  case "$arg" in
    --device)   RUN_ON_DEVICE=true ;;
    --setup)    SETUP_ONLY=true ;;
    *)
      if [ "$RUN_ON_DEVICE" = true ] && [ -z "$DEVICE_NAME" ]; then
        DEVICE_NAME="$arg"
      fi
      ;;
  esac
done

printf "\n"
printf "${BOLD}${CYAN}ShareGo — iOS development${RESET}\n"
printf "\n"

# ================================================================
# prerequisites
# ================================================================
step "checking prerequisites"

# xcode
if ! has_cmd xcodebuild; then
  die "Xcode not found — install from the App Store and open it once to accept the license"
fi
ok "xcode $(xcodebuild -version 2>/dev/null | head -1)"

# cocoapods
if ! has_cmd pod; then
  info "cocoapods not found — installing..."
  if has_cmd brew; then
    brew install cocoapods
  else
    sudo gem install cocoapods
  fi
fi
ok "cocoapods $(pod --version 2>/dev/null)"

# node
if ! has_cmd node; then
  die "node.js not found — install from https://nodejs.org (>= 18)"
fi
ok "node $(node -v)"

# ================================================================
# install dependencies if needed
# ================================================================
step "checking dependencies"
cd "$PROJECT_ROOT"

if [ ! -d "node_modules" ]; then
  info "installing npm dependencies..."
  npm install
  ok "dependencies installed"
else
  ok "npm dependencies present"
fi

# ================================================================
# build core if needed
# ================================================================
if [ ! -f "$PROJECT_ROOT/core/dist/index.js" ]; then
  step "building core library"
  npm run build:core
  ok "core built"
else
  ok "core library already built"
fi

# ================================================================
# install pods if needed
# ================================================================
step "checking iOS pods"
cd "$IOS_DIR"

if [ ! -d "Pods" ] || [ "Podfile" -nt "Podfile.lock" ]; then
  info "installing cocoapods dependencies (this may take a minute)..."
  pod install
  ok "pods installed"
else
  ok "pods up to date"
fi

if [ "$SETUP_ONLY" = true ]; then
  printf "\n"
  printf "${GREEN}${BOLD}✓ iOS setup complete — ready to develop${RESET}\n"
  printf "\n"
  printf "  to run later:\n"
  printf "    ${CYAN}cd apps/mobile-rn && npx react-native run-ios${RESET}\n"
  printf "\n"
  printf "  or open in Xcode:\n"
  printf "    ${CYAN}open apps/mobile-rn/ios/ShareGo.xcworkspace${RESET}\n"
  printf "\n"
  exit 0
fi

# ================================================================
# run the app
# ================================================================
cd "$MOBILE_DIR"

if [ "$RUN_ON_DEVICE" = true ]; then
  step "running on physical device"
  printf "\n"
  printf "  ${BOLD}important:${RESET} to run on a physical iPhone, you need to:\n"
  printf "    1. open ${CYAN}apps/mobile-rn/ios/ShareGo.xcworkspace${RESET} in Xcode\n"
  printf "    2. go to ${BOLD}Signing & Capabilities${RESET} tab\n"
  printf "    3. select your Apple ID as the team\n"
  printf "    4. Xcode will create a provisioning profile automatically\n"
  printf "\n"
  printf "  ${DIM}if this is your first time, you also need to trust the developer${RESET}\n"
  printf "  ${DIM}on your iPhone: Settings > General > VPN & Device Management${RESET}\n"
  printf "\n"

  if [ -n "$DEVICE_NAME" ]; then
    npx react-native run-ios --device "$DEVICE_NAME"
  else
    npx react-native run-ios --device
  fi
else
  step "running on iOS simulator"
  npx react-native run-ios
fi
