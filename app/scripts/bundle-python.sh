#!/usr/bin/env bash
# bundle-python.sh — Download python-build-standalone and install ezagent wheel
# Usage: ./scripts/bundle-python.sh [--force]
#
# This script:
#   1. Downloads a python-build-standalone release (Python 3.12)
#   2. Extracts it to runtime/python/
#   3. Installs the ezagent wheel + dependencies
#   4. Creates runtime/.bundled marker file
#
# Exit codes:
#   0  Success
#   1  General error
#   2  Unsupported platform/architecture
#   3  Download failed
#   4  Extraction failed
#   5  pip install failed

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
RUNTIME_DIR="$APP_DIR/runtime"
PYTHON_DIR="$RUNTIME_DIR/python"
MARKER_FILE="$RUNTIME_DIR/.bundled"

PYTHON_VERSION="3.12"
# python-build-standalone release tag — update as needed
PBS_RELEASE="20240415"
PBS_BASE_URL="https://github.com/indygreg/python-build-standalone/releases/download/${PBS_RELEASE}"

FORCE=false

# --- Parse arguments ---
for arg in "$@"; do
  case "$arg" in
    --force)
      FORCE=true
      ;;
    -h|--help)
      echo "Usage: $0 [--force]"
      echo ""
      echo "Downloads python-build-standalone (Python ${PYTHON_VERSION}) and installs ezagent."
      echo ""
      echo "Options:"
      echo "  --force   Re-download even if runtime/.bundled exists"
      echo "  -h        Show this help message"
      exit 0
      ;;
    *)
      echo "Error: Unknown argument: $arg" >&2
      exit 1
      ;;
  esac
done

# --- Check if already bundled ---
if [ "$FORCE" = false ] && [ -f "$MARKER_FILE" ]; then
  echo "Python runtime already bundled ($(cat "$MARKER_FILE"))."
  echo "Use --force to re-download."
  exit 0
fi

# --- Detect platform and architecture ---
detect_platform() {
  local os arch

  case "$(uname -s)" in
    Darwin)
      os="apple-darwin"
      ;;
    Linux)
      os="unknown-linux-gnu"
      ;;
    MINGW*|MSYS*|CYGWIN*)
      os="pc-windows-msvc-shared"
      ;;
    *)
      echo "Error: Unsupported operating system: $(uname -s)" >&2
      exit 2
      ;;
  esac

  case "$(uname -m)" in
    x86_64|amd64)
      arch="x86_64"
      ;;
    arm64|aarch64)
      arch="aarch64"
      ;;
    *)
      echo "Error: Unsupported architecture: $(uname -m)" >&2
      exit 2
      ;;
  esac

  # python-build-standalone naming convention
  echo "${arch}-${os}"
}

PLATFORM=$(detect_platform)
ARCHIVE_NAME="cpython-${PYTHON_VERSION}.3+${PBS_RELEASE}-${PLATFORM}-install_only.tar.gz"
DOWNLOAD_URL="${PBS_BASE_URL}/${ARCHIVE_NAME}"

echo "=== EZAgent Python Runtime Bundler ==="
echo "Platform:  $PLATFORM"
echo "Python:    $PYTHON_VERSION"
echo "Archive:   $ARCHIVE_NAME"
echo "Target:    $RUNTIME_DIR"
echo ""

# --- Clean previous runtime ---
if [ -d "$PYTHON_DIR" ]; then
  echo "Removing previous Python runtime..."
  rm -rf "$PYTHON_DIR"
fi

mkdir -p "$RUNTIME_DIR"

# --- Download ---
TEMP_DIR=$(mktemp -d)
TEMP_ARCHIVE="$TEMP_DIR/$ARCHIVE_NAME"

cleanup() {
  echo "Cleaning up temporary files..."
  rm -rf "$TEMP_DIR"
}
trap cleanup EXIT

echo "Downloading python-build-standalone..."
echo "  URL: $DOWNLOAD_URL"

if ! curl -fSL --progress-bar -o "$TEMP_ARCHIVE" "$DOWNLOAD_URL"; then
  echo "Error: Download failed." >&2
  echo "  URL: $DOWNLOAD_URL" >&2
  echo "  Verify the release tag and platform are correct." >&2
  exit 3
fi

echo "Download complete ($(du -h "$TEMP_ARCHIVE" | cut -f1))."

# --- Extract ---
echo "Extracting to $PYTHON_DIR..."

if ! tar xzf "$TEMP_ARCHIVE" -C "$RUNTIME_DIR"; then
  echo "Error: Extraction failed." >&2
  exit 4
fi

# python-build-standalone extracts to a 'python/' directory by default
if [ ! -d "$PYTHON_DIR" ]; then
  # Some archives extract to 'python/install/' — handle that case
  if [ -d "$RUNTIME_DIR/python/install" ]; then
    mv "$RUNTIME_DIR/python/install"/* "$PYTHON_DIR/"
    rm -rf "$RUNTIME_DIR/python/install"
  else
    echo "Error: Expected $PYTHON_DIR directory after extraction." >&2
    exit 4
  fi
fi

echo "Extraction complete."

# --- Determine pip path ---
if [ -f "$PYTHON_DIR/bin/pip3" ]; then
  PIP="$PYTHON_DIR/bin/pip3"
elif [ -f "$PYTHON_DIR/bin/pip" ]; then
  PIP="$PYTHON_DIR/bin/pip"
elif [ -f "$PYTHON_DIR/Scripts/pip.exe" ]; then
  # Windows
  PIP="$PYTHON_DIR/Scripts/pip.exe"
else
  echo "Error: Could not find pip in the extracted Python runtime." >&2
  exit 5
fi

# --- Install ezagent ---
echo "Installing ezagent wheel + dependencies..."

if ! "$PIP" install --no-warn-script-location ezagent; then
  echo "Error: pip install failed." >&2
  echo "  The ezagent package may not be published yet." >&2
  echo "  You can install a local wheel instead:" >&2
  echo "    $PIP install /path/to/ezagent-*.whl" >&2
  exit 5
fi

echo "Installation complete."

# --- Create marker file ---
echo "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" > "$MARKER_FILE"

echo ""
echo "=== Bundle complete ==="
echo "  Python: $PYTHON_DIR"
echo "  Marker: $MARKER_FILE"
echo "  Time:   $(cat "$MARKER_FILE")"
