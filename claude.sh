#!/bin/bash

# Source shell configuration for proper PATH setup
# Try zsh config first (most common on macOS), then bash
if [ -f "$HOME/.zprofile" ]; then
    source "$HOME/.zprofile" 2>/dev/null
fi
if [ -f "$HOME/.zshrc" ]; then
    # Only source non-interactive parts (avoid prompt/completion issues)
    export ZDOTDIR_BACKUP="$ZDOTDIR"
    source "$HOME/.zshrc" 2>/dev/null
fi
if [ -f "$HOME/.bash_profile" ]; then
    source "$HOME/.bash_profile" 2>/dev/null
fi
if [ -f "$HOME/.bashrc" ]; then
    source "$HOME/.bashrc" 2>/dev/null
fi

# Ensure common paths are included as fallback (Homebrew on Apple Silicon / Intel, npm global)
export PATH="/opt/homebrew/bin:/usr/local/bin:$HOME/.npm-global/bin:$HOME/.local/bin:$PATH"

# Proxy settings
export ALL_PROXY=http://127.0.0.1:7897
export HTTP_PROXY=http://127.0.0.1:7897
export HTTPS_PROXY=http://127.0.0.1:7897

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Get project name from directory (sanitize for tmux session name)
PROJECT_NAME=$(basename "$SCRIPT_DIR" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9_-]/-/g')

# Session naming: claude-PROJECT-YYYYMMDD-UUID
generate_session_name() {
    local date_part=$(date +%Y%m%d)
    local uuid_part=$(uuidgen | cut -d'-' -f1 | tr '[:upper:]' '[:lower:]')
    echo "claude-${PROJECT_NAME}-${date_part}-${uuid_part}"
}

# Session prefix for this project
SESSION_PREFIX="claude-${PROJECT_NAME}"

# Check if tmux is available
if ! command -v tmux &> /dev/null; then
    echo "❌ tmux not found!"
    echo ""
    echo "Please install tmux first:"
    echo "  brew install tmux"
    exit 1
fi

# Check if running inside tmux
if [ -z "$TMUX" ]; then
    echo "🔍 Checking for existing sessions in project: $PROJECT_NAME"
    echo ""

    # List all tmux sessions for THIS project only
    EXISTING_SESSIONS=$(tmux list-sessions -F '#{session_name}' 2>/dev/null | grep -E "^${SESSION_PREFIX}" || true)

    if [ -n "$EXISTING_SESSIONS" ]; then
        # Found existing claude session(s)
        SESSION_COUNT=$(echo "$EXISTING_SESSIONS" | wc -l | tr -d ' ')

        if [ "$SESSION_COUNT" -eq 1 ]; then
            # Only one session, ask to attach
            echo "📌 Found existing session: $EXISTING_SESSIONS"
            echo ""
            read -p "Attach to this session? [Y/n] " -n 1 -r
            echo ""

            if [[ ! $REPLY =~ ^[Nn]$ ]]; then
                exec tmux attach -t "$EXISTING_SESSIONS"
            else
                # User wants a new session, create with unique name
                NEW_SESSION=$(generate_session_name)
                echo "Creating new session: $NEW_SESSION"
                exec tmux new-session -s "$NEW_SESSION" "cd '$SCRIPT_DIR' && '$0'"
            fi
        else
            # Multiple sessions, let user choose
            echo "📌 Found multiple sessions for project '$PROJECT_NAME':"
            echo ""
            i=1
            declare -a SESSION_ARRAY
            while IFS= read -r session; do
                # Get session info
                INFO=$(tmux list-sessions -F '#{session_name}: #{session_windows} windows, created #{session_created}' 2>/dev/null | grep "^$session:")
                echo "  [$i] $INFO"
                SESSION_ARRAY[$i]="$session"
                ((i++))
            done <<< "$EXISTING_SESSIONS"
            echo "  [n] Create new session"
            echo ""
            read -p "Select session [1]: " -r CHOICE

            if [[ "$CHOICE" =~ ^[Nn]$ ]]; then
                NEW_SESSION=$(generate_session_name)
                echo "Creating new session: $NEW_SESSION"
                exec tmux new-session -s "$NEW_SESSION" "cd '$SCRIPT_DIR' && '$0'"
            elif [ -z "$CHOICE" ] || [ "$CHOICE" = "1" ]; then
                exec tmux attach -t "${SESSION_ARRAY[1]}"
            elif [[ "$CHOICE" =~ ^[0-9]+$ ]] && [ "$CHOICE" -le "${#SESSION_ARRAY[@]}" ]; then
                exec tmux attach -t "${SESSION_ARRAY[$CHOICE]}"
            else
                echo "Invalid choice, attaching to first session"
                exec tmux attach -t "${SESSION_ARRAY[1]}"
            fi
        fi
    else
        # No existing session, create new one
        NEW_SESSION=$(generate_session_name)
        echo "📍 No existing session found for project: $PROJECT_NAME"
        echo "🚀 Creating new tmux session: $NEW_SESSION"
        echo ""
        exec tmux new-session -s "$NEW_SESSION" "cd '$SCRIPT_DIR' && '$0'"
    fi
fi

# ============================================
# Code below runs INSIDE tmux session
# ============================================

# Change to script directory
cd "$SCRIPT_DIR"

# Show session info
CURRENT_SESSION=$(tmux display-message -p '#S')
echo "✅ Running in tmux session: $CURRENT_SESSION"
echo "📂 Working directory: $(pwd)"
echo ""

# Check if claude is available
if ! command -v claude &> /dev/null; then
    echo "❌ claude command not found!"
    echo ""
    echo "PATH: $PATH"
    echo ""
    echo "Please install Claude Code first:"
    echo "  npm install -g @anthropic-ai/claude-code"
    echo ""
    echo "Press any key to exit..."
    read -n 1
    exit 1
fi

echo "💡 Tips:"
echo "   Session:"
echo "     - Detach (keep running): Ctrl+b, d"
echo "     - Reattach after disconnect: ./claude.sh"
echo ""
echo "   Panes (split screen):"
echo "     - Split horizontally: Ctrl+b, \""
echo "     - Split vertically:   Ctrl+b, %"
echo "     - Switch pane:        Ctrl+b, arrow keys"
echo "     - Close current pane: Ctrl+b, x (or type 'exit')"
echo "     - Zoom pane (toggle): Ctrl+b, z"
echo ""
echo "   Windows (tabs):"
echo "     - New window:    Ctrl+b, c"
echo "     - Next window:   Ctrl+b, n"
echo "     - Prev window:   Ctrl+b, p"
echo "     - Close window:  Ctrl+b, &"
echo "     - List windows:  Ctrl+b, w"
echo ""
echo "   Scroll/Copy:"
echo "     - Enter scroll mode: Ctrl+b, ["
echo "     - Exit scroll mode:  q"
echo ""

# Run claude
claude --permission-mode bypassPermissions --mcp-config .claude/mcp.json
EXIT_CODE=$?

if [ $EXIT_CODE -ne 0 ]; then
    echo ""
    echo "⚠️  Claude exited with code: $EXIT_CODE"
    echo "Press any key to close this session..."
    read -n 1
fi
