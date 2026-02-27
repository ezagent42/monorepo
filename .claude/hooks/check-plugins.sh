#!/usr/bin/env bash
# check-plugins.sh — SessionStart hook: verify required plugins are installed.
# Outputs a reminder if any declared plugin in enabledPlugins is missing locally.

set -euo pipefail

INSTALLED_DB="$HOME/.claude/plugins/installed_plugins.json"
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
SETTINGS_JSON="$PROJECT_DIR/.claude/settings.json"

# Read required plugins from settings.json enabledPlugins (keys where value is true)
if [[ ! -f "$SETTINGS_JSON" ]]; then
  exit 0
fi

REQUIRED_PLUGINS=()
while IFS= read -r line; do
  [[ -n "$line" ]] && REQUIRED_PLUGINS+=("$line")
done < <(
  jq -r '.enabledPlugins // {} | to_entries[] | select(.value == true) | .key' \
    "$SETTINGS_JSON" 2>/dev/null
)

# Nothing declared — nothing to check
if [[ ${#REQUIRED_PLUGINS[@]} -eq 0 ]]; then
  exit 0
fi

# If installed_plugins.json doesn't exist, all plugins are missing
if [[ ! -f "$INSTALLED_DB" ]]; then
  for plugin in "${REQUIRED_PLUGINS[@]}"; do
    echo "⚠️  Required plugin not installed: $plugin"
    echo "   Run: claude plugin install $plugin --scope project"
  done
  exit 0
fi

MISSING=()
for plugin in "${REQUIRED_PLUGINS[@]}"; do
  # Check if plugin has an entry matching this project path
  FOUND=$(jq -r --arg p "$plugin" --arg dir "$PROJECT_DIR" '
    .plugins[$p] // [] |
    map(select(.projectPath == $dir)) |
    length
  ' "$INSTALLED_DB" 2>/dev/null || echo "0")

  if [[ "$FOUND" -eq 0 ]]; then
    MISSING+=("$plugin")
  fi
done

if [[ ${#MISSING[@]} -gt 0 ]]; then
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "  Missing required Claude Code plugins"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  for plugin in "${MISSING[@]}"; do
    echo "  ▸ $plugin"
  done
  echo ""
  echo "  Install with:"
  for plugin in "${MISSING[@]}"; do
    echo "    claude plugin install $plugin --scope project"
  done
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
fi

exit 0
