#!/usr/bin/env bash
# build the @sharego/core library
# usage: ./scripts/build-core.sh

source "$(dirname "$0")/preflight.sh"

banner "build: @sharego/core"

# -- preflight --
step "checking prerequisites"
check_node
check_pnpm
check_node_modules
assert_preflight

# -- build --
step "building core library"
cd "$PROJECT_ROOT"
pnpm run build:core

if [ ! -f "$PROJECT_ROOT/core/dist/index.js" ]; then
  die "core build produced no output — check for TypeScript errors above"
fi

success "core library built → core/dist/"
