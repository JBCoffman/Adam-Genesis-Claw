#!/usr/bin/env bash
# install.sh — install the openclaw-logger plugin into OpenClaw
# Usage: ./install.sh
# Logs will be written to ~/.openclaw/logs/conversations/ (inside the Docker volume mount)
# and are accessible on the host at the same path.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PLUGIN_SRC="$SCRIPT_DIR/openclaw-logger"
# openclaw auto-discovers plugins from ~/.openclaw/extensions/ — use that, not plugins/
INSTALL_TARGET="$HOME/.openclaw/extensions/openclaw-logger"
CONFIG_FILE="$HOME/.openclaw/openclaw.json"
# Log dir must be inside ~/.openclaw/ — it's the only path bind-mounted into the container.
# Inside the container this becomes /home/node/.openclaw/logs/conversations
CONTAINER_LOG_DIR="/home/node/.openclaw/logs/conversations"

echo ""
echo "=== openclaw-logger installer ==="
echo "Plugin source : $PLUGIN_SRC"
echo "Install target: $INSTALL_TARGET"
echo "Log dir (in container): $CONTAINER_LOG_DIR"
echo "Log dir (on host):      $HOME/.openclaw/logs/conversations"
echo ""

# ---------------------------------------------------------------------------
# Step 1 — check Node.js 18+
# ---------------------------------------------------------------------------

echo "[1/7] Checking Node.js..."
if ! command -v node &>/dev/null; then
  echo "ERROR: node not found. Install Node.js 18+ and retry."
  exit 1
fi

NODE_MAJOR=$(node -e "process.stdout.write(String(process.versions.node.split('.')[0]))")
if [ "$NODE_MAJOR" -lt 18 ]; then
  echo "ERROR: Node.js 18+ required (found v$(node --version))."
  exit 1
fi
echo "  OK — Node.js v$(node --version)"

# ---------------------------------------------------------------------------
# Step 2 — check npm
# ---------------------------------------------------------------------------

echo "[2/7] Checking npm..."
if ! command -v npm &>/dev/null; then
  echo "ERROR: npm not found."
  exit 1
fi
echo "  OK — npm $(npm --version)"

# ---------------------------------------------------------------------------
# Step 3 — build
# ---------------------------------------------------------------------------

echo "[3/7] Installing dependencies and building..."
cd "$PLUGIN_SRC"
npm install --silent
npm run build
echo "  OK — build complete"

# ---------------------------------------------------------------------------
# Step 4 — install into ~/.openclaw/extensions/
# ---------------------------------------------------------------------------

echo "[4/7] Copying plugin to $INSTALL_TARGET..."
mkdir -p "$INSTALL_TARGET"

rsync -a --delete \
  --exclude='node_modules/.cache' \
  --exclude='src/' \
  --exclude='*.ts' \
  --exclude='.git' \
  "$PLUGIN_SRC/" "$INSTALL_TARGET/"

cd "$INSTALL_TARGET"
npm install --omit=dev --silent
echo "  OK — plugin files installed"

# ---------------------------------------------------------------------------
# Step 5 — validate existing config is parseable before touching it
# ---------------------------------------------------------------------------

echo "[5/7] Updating openclaw.json..."
mkdir -p "$(dirname "$CONFIG_FILE")"

if [ ! -f "$CONFIG_FILE" ]; then
  echo "{}" > "$CONFIG_FILE"
fi

# Safety check — abort if existing config isn't valid JSON
if ! jq empty "$CONFIG_FILE" 2>/dev/null; then
  echo "ERROR: $CONFIG_FILE is not valid JSON. Fix it manually before retrying."
  exit 1
fi

# Merge plugin entry using config.logDir (NOT env — that field is not in the schema)
UPDATED=$(jq \
  --arg dir "$CONTAINER_LOG_DIR" \
  '
    .plugins //= {} |
    .plugins.entries //= {} |
    .plugins.entries["openclaw-logger"] = {
      "enabled": true,
      "config": {
        "logDir": $dir
      }
    }
  ' "$CONFIG_FILE")

# Validate the result before writing
if ! echo "$UPDATED" | jq empty 2>/dev/null; then
  echo "ERROR: Config merge produced invalid JSON. Aborting without changes."
  exit 1
fi

echo "$UPDATED" > "$CONFIG_FILE"
echo "  OK — openclaw-logger entry written to config"

# ---------------------------------------------------------------------------
# Step 6 — create log directory on host
# ---------------------------------------------------------------------------

echo "[6/7] Creating log directory on host..."
mkdir -p "$HOME/.openclaw/logs/conversations"
echo "  OK — $HOME/.openclaw/logs/conversations"

# ---------------------------------------------------------------------------
# Done
# ---------------------------------------------------------------------------

echo ""
echo "[7/7] Install complete."
echo ""
echo "  ┌─────────────────────────────────────────────────────────────┐"
echo "  │  REQUIRED: Restart your OpenClaw Gateway to activate        │"
echo "  │  the plugin. In Docker Desktop, stop and start the          │"
echo "  │  openclaw container.                                        │"
echo "  └─────────────────────────────────────────────────────────────┘"
echo ""
echo "  After restart, validate with:"
echo "    ./test-logger.sh"
echo ""
echo "  Logs will appear at:"
echo "    $HOME/.openclaw/logs/conversations/openclaw-YYYY-MM-DD.jsonl"
echo ""
