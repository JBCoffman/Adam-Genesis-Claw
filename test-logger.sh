#!/usr/bin/env bash
# test-logger.sh — validate the openclaw-logger plugin after install + Gateway restart
# Usage: ./test-logger.sh

set -euo pipefail

LOG_OUTPUT_PATH="$HOME/.openclaw/logs/conversations"
CONTAINER="openclaw-openclaw-gateway-1"

PASS=0
FAIL=0

pass() { echo "  PASS  $1"; PASS=$((PASS + 1)); }
fail() { echo "  FAIL  $1"; FAIL=$((FAIL + 1)); }

echo ""
echo "=== openclaw-logger validation ==="
echo "Log directory: $LOG_OUTPUT_PATH"
echo "  (host path — same as /home/node/.openclaw/logs/conversations inside container)"
echo ""

# ---------------------------------------------------------------------------
# Step 1 — Gateway health (via Docker, no CLI needed)
# ---------------------------------------------------------------------------

echo "[1/7] Checking Gateway health..."
CONTAINER_STATUS=$(docker inspect --format='{{.State.Status}}' "$CONTAINER" 2>/dev/null || echo "not found")
if [ "$CONTAINER_STATUS" = "running" ]; then
  pass "Container $CONTAINER is running"
else
  fail "Container $CONTAINER is not running (status: $CONTAINER_STATUS) — start it in Docker Desktop"
  exit 1
fi

# ---------------------------------------------------------------------------
# Step 2 — Plugin loaded in container logs
# ---------------------------------------------------------------------------

echo "[2/7] Checking plugin is loaded..."
if docker logs "$CONTAINER" 2>&1 | grep -q "openclaw-logger"; then
  pass "openclaw-logger found in Gateway logs"
else
  # Not fatal — plugin may load silently; warn and continue
  echo "  WARN  openclaw-logger not seen in Gateway logs yet"
  echo "        If the install just completed, make sure you restarted the container."
fi

# ---------------------------------------------------------------------------
# Step 3 — Send test message via Docker exec
# ---------------------------------------------------------------------------

echo "[3/7] Sending test message through agent..."
BEFORE_TS=$(date +%s)

if docker exec "$CONTAINER" openclaw agent --agent main --message "Logger test ping — please reply with the word PONG" &>/dev/null; then
  pass "Test message sent"
else
  fail "openclaw agent command failed inside container"
  echo "  Check: docker logs $CONTAINER --tail 20"
  exit 1
fi

# ---------------------------------------------------------------------------
# Step 4 — Wait for log file
# ---------------------------------------------------------------------------

echo "[4/7] Waiting for log entry (up to 30 seconds)..."
LOG_DATE=$(date -u +%Y-%m-%d)
LOG_FILE="$LOG_OUTPUT_PATH/openclaw-${LOG_DATE}.jsonl"

WAIT=0
while [ $WAIT -lt 30 ]; do
  if [ -f "$LOG_FILE" ]; then
    FILE_MTIME=$(stat -f %m "$LOG_FILE" 2>/dev/null || stat -c %Y "$LOG_FILE" 2>/dev/null || echo 0)
    if [ "$FILE_MTIME" -ge "$BEFORE_TS" ]; then
      break
    fi
  fi
  sleep 1
  WAIT=$((WAIT + 1))
done

if [ ! -f "$LOG_FILE" ]; then
  fail "Log file not found: $LOG_FILE"
  echo ""
  echo "  Troubleshooting:"
  echo "  - Did you restart the container after running ./install.sh?"
  echo "  - Check: docker logs $CONTAINER --tail 30"
  exit 1
fi

FILE_MTIME=$(stat -f %m "$LOG_FILE" 2>/dev/null || stat -c %Y "$LOG_FILE" 2>/dev/null || echo 0)
NOW=$(date +%s)
AGE=$((NOW - FILE_MTIME))
if [ "$AGE" -le 60 ]; then
  pass "Log file written in the last ${AGE}s"
else
  fail "Log file exists but was not recently modified (last write ${AGE}s ago)"
fi

# ---------------------------------------------------------------------------
# Step 5 — Parse last entry
# ---------------------------------------------------------------------------

echo "[5/7] Reading last log entry..."
LAST_ENTRY=$(tail -1 "$LOG_FILE")

if [ -z "$LAST_ENTRY" ]; then
  fail "Log file is empty"
  exit 1
fi
pass "Log entry found"

# ---------------------------------------------------------------------------
# Step 6 — Validate required fields
# ---------------------------------------------------------------------------

echo "[6/7] Validating required fields..."

check_field() {
  local field="$1"
  local value
  if command -v jq &>/dev/null; then
    value=$(echo "$LAST_ENTRY" | jq -r ".$field // empty" 2>/dev/null)
  else
    value=$(node -e "
      const e = JSON.parse(process.argv[1]);
      const v = e['$field'];
      if (v !== null && v !== undefined && v !== '') process.stdout.write(String(v));
    " "$LAST_ENTRY" 2>/dev/null)
  fi

  if [ -n "$value" ]; then
    pass "$field = $value"
  else
    fail "$field is missing or empty"
  fi
}

check_field "session_id"
check_field "model"
check_field "response_text"
check_field "timestamp"
check_field "latency_ms"

# user_message is best-effort — warn but don't fail
if command -v jq &>/dev/null; then
  USER_MSG=$(echo "$LAST_ENTRY" | jq -r '.user_message // empty')
else
  USER_MSG=$(node -e "const e=JSON.parse(process.argv[1]);if(e.user_message)process.stdout.write(e.user_message)" "$LAST_ENTRY" 2>/dev/null)
fi
if [ -n "$USER_MSG" ]; then
  pass "user_message = $USER_MSG"
else
  echo "  WARN  user_message is null (normal for CLI-triggered runs)"
fi

# ---------------------------------------------------------------------------
# Step 7 — Pretty print
# ---------------------------------------------------------------------------

echo "[7/7] Last log entry:"
echo ""
if command -v jq &>/dev/null; then
  echo "$LAST_ENTRY" | jq '{
    timestamp,
    session_id,
    agent_id,
    channel,
    model,
    user_message,
    response_text: (.response_text | if . then .[0:120] + "…" else null end),
    thinking_enabled,
    input_tokens,
    output_tokens,
    latency_ms,
    status
  }'
else
  node -e "
    const e = JSON.parse(process.argv[1]);
    const display = {
      timestamp: e.timestamp,
      session_id: e.session_id,
      agent_id: e.agent_id,
      channel: e.channel,
      model: e.model,
      user_message: e.user_message,
      response_text: e.response_text ? e.response_text.slice(0, 120) + '…' : null,
      thinking_enabled: e.thinking_enabled,
      input_tokens: e.input_tokens,
      output_tokens: e.output_tokens,
      latency_ms: e.latency_ms,
      status: e.status,
    };
    console.log(JSON.stringify(display, null, 2));
  " "$LAST_ENTRY"
fi

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------

echo ""
if [ "$FAIL" -eq 0 ]; then
  echo "=== RESULT: PASS ($PASS checks passed) ==="
else
  echo "=== RESULT: FAIL ($PASS passed, $FAIL failed) ==="
  exit 1
fi
echo ""
