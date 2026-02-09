#!/usr/bin/env bash
# shared preflight check helpers — sourced by all build scripts

set -euo pipefail

# -- colors --
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
RESET='\033[0m'

# -- state --
PREFLIGHT_ERRORS=0

# -- helpers --

info()  { printf "${BLUE}[info]${RESET}  %s\n" "$*"; }
ok()    { printf "${GREEN}[ok]${RESET}    %s\n" "$*"; }
warn()  { printf "${YELLOW}[warn]${RESET}  %s\n" "$*"; }
fail()  { printf "${RED}[fail]${RESET}  %s\n" "$*"; PREFLIGHT_ERRORS=$((PREFLIGHT_ERRORS + 1)); }
step()  { printf "\n${BOLD}▸ %s${RESET}\n" "$*"; }
banner() {
  printf "\n${BOLD}${BLUE}╭─────────────────────────────────────────╮${RESET}\n"
  printf "${BOLD}${BLUE}│${RESET}  ${BOLD}%-39s${RESET}  ${BOLD}${BLUE}│${RESET}\n" "$*"
  printf "${BOLD}${BLUE}╰─────────────────────────────────────────╯${RESET}\n\n"
}

die() {
  printf "\n${RED}${BOLD}✗ build aborted:${RESET} %s\n\n" "$*"
  exit 1
}

success() {
  printf "\n${GREEN}${BOLD}✓ %s${RESET}\n\n" "$*"
}

# check that a command exists, with install hint on failure
require_cmd() {
  local cmd="$1"
  local hint="${2:-}"
  if command -v "$cmd" &>/dev/null; then
    local version
    version=$("$cmd" --version 2>/dev/null | head -1 || echo "unknown")
    ok "$cmd found ($version)"
  else
    if [ -n "$hint" ]; then
      fail "$cmd not found — $hint"
    else
      fail "$cmd not found"
    fi
  fi
}

# check that a command exists (silent — just return 0/1)
has_cmd() {
  command -v "$1" &>/dev/null
}

# check minimum node version
check_node() {
  if ! has_cmd node; then
    fail "node not found — install from https://nodejs.org (>= 18)"
    return
  fi
  local node_version
  node_version=$(node -v | sed 's/^v//')
  local major
  major=$(echo "$node_version" | cut -d. -f1)
  if [ "$major" -ge 18 ]; then
    ok "node $node_version (>= 18 required)"
  else
    fail "node $node_version is too old — need >= 18 (https://nodejs.org)"
  fi
}

# check pnpm exists
check_pnpm() {
  require_cmd pnpm "install via corepack: corepack enable && corepack prepare pnpm@latest --activate"
}

# check that node_modules exist
check_node_modules() {
  if [ -d "$PROJECT_ROOT/node_modules" ]; then
    ok "node_modules installed"
  else
    fail "node_modules missing — run 'pnpm install' in the project root first"
  fi
}

# check that core is built
check_core_built() {
  if [ -f "$PROJECT_ROOT/core/dist/index.js" ]; then
    ok "core library built (core/dist/index.js)"
  else
    warn "core library not built yet — will build automatically"
  fi
}

# detect OS
detect_os() {
  case "$(uname -s)" in
    Darwin*)  echo "macos" ;;
    Linux*)   echo "linux" ;;
    MINGW*|MSYS*|CYGWIN*) echo "windows" ;;
    *)        echo "unknown" ;;
  esac
}

# bail if any preflight checks failed
assert_preflight() {
  if [ "$PREFLIGHT_ERRORS" -gt 0 ]; then
    die "$PREFLIGHT_ERRORS prerequisite(s) missing — fix the issues above and retry"
  fi
  ok "all prerequisites satisfied"
}

# resolve project root (parent of scripts/)
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
