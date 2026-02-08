#!/usr/bin/env bash
# build ShareGo desktop app (Electron) for the current platform
#
# usage:
#   ./scripts/build-desktop.sh            # release build
#   ./scripts/build-desktop.sh --debug    # debug build
#
# outputs:
#   macos   → apps/app/release/*.dmg
#   linux   → apps/app/release/*.AppImage, *.deb
#   windows → apps/app/release/*.exe, *.msi

source "$(dirname "$0")/preflight.sh"

MODE="release"
if [[ "${1:-}" == "--debug" ]]; then
  MODE="debug"
fi

banner "build: desktop ($MODE)"

OS=$(detect_os)

# -- preflight --
step "checking prerequisites"

check_node
check_npm
check_node_modules

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

# -- build electron main process --
step "building electron main process"
cd "$PROJECT_ROOT/apps/app"
npm run build:electron
ok "electron main process compiled"

# -- build desktop --
step "building electron desktop app ($MODE)"
cd "$PROJECT_ROOT/apps/app"

if [ "$MODE" = "debug" ]; then
  npx electron-builder --dir
else
  npx electron-builder
fi

# -- report output --
step "build artifacts"
RELEASE_DIR="$PROJECT_ROOT/apps/app/release"

if [ -d "$RELEASE_DIR" ]; then
  info "artifacts in: $RELEASE_DIR"
  for f in "$RELEASE_DIR"/*; do
    case "$f" in
      *.dmg|*.deb|*.AppImage|*.rpm|*.msi|*.exe|*.snap)
        [ -f "$f" ] && ok "→ $f"
        ;;
    esac
  done
  success "desktop build complete ($MODE)"
else
  if [ "$MODE" = "debug" ]; then
    # --dir mode puts output in dist/
    DIST_DIR="$PROJECT_ROOT/apps/app/dist"
    if [ -d "$DIST_DIR" ]; then
      ok "unpacked app in: $DIST_DIR"
      success "desktop build complete ($MODE) — unpacked"
    else
      die "build finished but no artifacts found"
    fi
  else
    die "build finished but no artifacts found at $RELEASE_DIR"
  fi
fi
