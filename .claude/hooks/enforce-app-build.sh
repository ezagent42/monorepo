#!/usr/bin/env bash
# enforce-app-build.sh — Block direct build/package commands for app/.
# Forces use of `make` targets in app/Makefile to ensure correct build order.
# Configured as a PreToolUse hook for the Bash tool.

set -euo pipefail

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

[ -z "$COMMAND" ] && exit 0

# --- Block direct electron-builder invocations ---
if echo "$COMMAND" | grep -qE '(^|[;&|])[[:space:]]*(pnpm exec )?electron-builder([[:space:]]|$)'; then
  cat >&2 <<'MSG'
BLOCKED: Direct electron-builder invocation is not allowed.
Use make targets in app/ instead:

  make package   — Build .app (Next.js + Electron TS + electron-builder)
  make dmg       — Build DMG installer
  make install   — Package + install to /Applications

This ensures Electron TypeScript is always compiled before packaging.
MSG
  exit 2
fi

# --- Block pnpm run package / build:electron (must go through make) ---
if echo "$COMMAND" | grep -qE 'pnpm run (package|build:electron)([[:space:]]|$)'; then
  cat >&2 <<'MSG'
BLOCKED: Use make targets instead of pnpm run package/build:electron.

  make package        — Build .app
  make dmg            — Build DMG
  make build-electron — Next.js + Electron TS compile only

MSG
  exit 2
fi

exit 0
