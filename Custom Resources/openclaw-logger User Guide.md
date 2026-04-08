# openclaw-logger User Guide

A plugin that silently records every LLM conversation through your OpenClaw Gateway to local JSONL files. Useful for understanding token usage, debugging agent behavior, reviewing what your agents said, and keeping a personal conversation archive.

---

## What It Does

Every time your agent completes a turn — whether triggered by Telegram, Discord, the browser webchat, or a CLI call — a log entry is written to disk. Each entry captures:

- Who said what (user message, agent response)
- Which model and provider handled it
- Token counts (input, output, total)
- Latency from prompt to response
- Whether extended thinking was active and what the agent was thinking
- Channel and session identity
- Status (ok or error)

Nothing is sent anywhere. Logs stay on your Mac at `~/.openclaw/logs/conversations/`.

---

## File Layout

```
~/.openclaw/
├── extensions/
│   └── openclaw-logger/          ← plugin source installed here
│       ├── openclaw.plugin.json
│       ├── package.json
│       └── dist/
│           └── index.js
└── logs/
    └── conversations/
        ├── openclaw-2026-04-07.jsonl
        ├── openclaw-2026-04-08.jsonl
        └── ...
```

One `.jsonl` file per UTC calendar day. Each line is a complete JSON object for one agent turn.

Inside the Docker container, the same files appear at `/home/node/.openclaw/logs/conversations/` — it is the same volume mount, not a copy.

---

## Installation

From the `Adamclaw/` project directory:

```bash
./install.sh
```

Then restart the gateway:

```bash
cd /Users/home/tools/Adamclaw && docker compose restart openclaw-gateway
```

### What the installer does

1. Builds the TypeScript source (`npm run build`)
2. Copies the built plugin to `~/.openclaw/extensions/openclaw-logger/`
3. Adds the plugin entry to `~/.openclaw/openclaw.json`:
   ```json
   "plugins": {
     "entries": {
       "openclaw-logger": {
         "enabled": true,
         "config": {
           "logDir": "/home/node/.openclaw/logs/conversations"
         }
       }
     }
   }
   ```
4. Creates `~/.openclaw/logs/conversations/` on the host

### Validate the install

```bash
./test-logger.sh
```

All 10 checks should pass. The test sends a real message through the agent and confirms a log entry was written with all required fields.

---

## Viewing Logs

### Quick terminal read

```bash
# Today's entries, pretty-printed
cat ~/.openclaw/logs/conversations/openclaw-$(date +%Y-%m-%d).jsonl | python3 -m json.tool

# With jq (brew install jq)
cat ~/.openclaw/logs/conversations/openclaw-$(date +%Y-%m-%d).jsonl | jq '.'
```

### Human-readable viewer (recommended)

The `view-logs.sh` script in this project formats each entry with word-wrapped response text, token summaries, and thinking content.

```bash
# Today's log
./view-logs.sh

# Specific date
./view-logs.sh 2026-04-06

# Last N entries
./view-logs.sh --tail 10

# Live tail — watch entries appear as conversations happen
./view-logs.sh --follow

# Only show error or incomplete entries
./view-logs.sh --errors

# Combine flags
./view-logs.sh --tail 5 --errors
./view-logs.sh --date 2026-04-06 --tail 20
```

### VisiData (spreadsheet view)

```bash
# Install once
pip3 install visidata

# Open today's log as a spreadsheet
/Users/home/Library/Python/3.9/bin/vd ~/.openclaw/logs/conversations/openclaw-$(date +%Y-%m-%d).jsonl
```

Key VisiData shortcuts:

- `g_` — widen all columns to fit content
- `z^` — open the current cell in a full scrollable viewer
- `q` — quit viewer / go back
- `[` / `]` — sort by current column ascending / descending

---

## Log Entry Reference

Every entry is a flat JSON object. All fields are always present; nullable fields use `null` when not available.

| Field                    | Type           | Description                                                                                  |
| ------------------------ | -------------- | -------------------------------------------------------------------------------------------- |
| `timestamp`              | string         | ISO 8601 UTC — when the entry was written                                                    |
| `run_id`                 | string         | UUID for this specific agent turn                                                            |
| `session_id`             | string         | UUID for the session (persists across turns)                                                 |
| `session_key`            | string \| null | Human-readable session identifier (e.g. `agent:main:main`)                                   |
| `agent_id`               | string \| null | Agent name (e.g. `main`)                                                                     |
| `channel`                | string \| null | Delivery channel: `telegram`, `discord`, `webchat`, etc.                                     |
| `user_message`           | string \| null | The inbound message text. Null for CLI-triggered runs                                        |
| `sender_id`              | string \| null | Who sent the message (channel-specific ID)                                                   |
| `conversation_id`        | string \| null | Channel-level conversation ID when available                                                 |
| `model`                  | string \| null | Model ID (e.g. `gemini-2.5-flash-lite`)                                                      |
| `provider`               | string \| null | Provider plugin ID (e.g. `google`)                                                           |
| `system_prompt_preview`  | string \| null | First 500 characters of the system prompt                                                    |
| `full_prompt_char_count` | number \| null | Total character count of system prompt + user prompt                                         |
| `thinking_enabled`       | boolean        | Whether extended thinking was active for this turn                                           |
| `thinking_level`         | string \| null | Thinking level if set (e.g. `low`, `medium`, `high`)                                         |
| `response_text`          | string \| null | The agent's full text response                                                               |
| `thinking_content`       | string \| null | The agent's raw thinking/reasoning text (Anthropic models)                                   |
| `input_tokens`           | number \| null | Tokens consumed by the prompt                                                                |
| `output_tokens`          | number \| null | Tokens generated in the response                                                             |
| `total_tokens`           | number \| null | Combined token count                                                                         |
| `latency_ms`             | number \| null | Milliseconds from prompt submission to response completion                                   |
| `status`                 | string         | `ok` or `error`                                                                              |
| `error`                  | string \| null | Error description if status is `error`                                                       |
| `delivered_text`         | string \| null | Text actually delivered to the channel (may differ from response_text for formatted replies) |

### Notes on null fields

- **`user_message` is null** for CLI-triggered runs (`openclaw agent --message ...`) because the CLI bypasses the `message_received` hook. Messages sent via Telegram, Discord, or the browser webchat will always populate this field.
- **`response_text` and token fields are null** for tool-only turns where the model made tool calls but produced no text output.
- **`thinking_content`** is only populated for Anthropic models with extended thinking enabled. Google/Gemini runs will always have this as null.

---

## How It Works (Architecture)

The plugin hooks into five Gateway events in sequence:

```
message_received  →  stores inbound message, keyed by channelId
      ↓
llm_input         →  stores session/model/prompt data; merges pending message
      ↓
agent_end         →  stores latency + status; does NOT write yet
      ↓
llm_output        →  stores response text + tokens; writes final entry
      ↓
message_sent      →  (best-effort) captures delivered text per channel
```

The write is triggered in `llm_output` rather than `agent_end` because the Gateway fires `agent_end` first, then `llm_output`. Writing in `agent_end` would produce entries with null response text every time.

If `llm_output` never fires (e.g. the agent errored before reaching the model), the entry is written with `status: error` and `error: llm_output_not_received` after a 10-minute stale TTL sweep.

In-flight runs are held in memory, keyed by `sessionId:runId`. The stale sweep runs every 60 seconds.

---

## Updating the Plugin

After editing source in `openclaw-logger/src/`:

```bash
cd openclaw-logger && npm run build
cp -r dist/ ~/.openclaw/extensions/openclaw-logger/dist/
```

Then restart the Gateway container. No need to rerun `install.sh` for code changes — that is only needed for first install or if `openclaw.json` config needs updating.

---

## Disabling the Plugin

In `~/.openclaw/openclaw.json`, set:

```json
"openclaw-logger": {
  "enabled": false
}
```

Then restart the Gateway. Existing log files are untouched.

---

## Troubleshooting

**"plugin not found: openclaw-logger" in Gateway logs**
The plugin manifest is missing or misconfigured. Verify `~/.openclaw/extensions/openclaw-logger/openclaw.plugin.json` exists and contains `"id": "openclaw-logger"` and a `"configSchema"` key.

**Log file exists but response_text is always null**
This was a known ordering bug (fixed April 2026). Make sure you have the latest build — `dist/index.js` should have the two-trigger write pattern where `onLlmOutput` handles the final write.

**No log file appears after conversations**

1. Check the Gateway restarted after install: `docker logs adamclaw-openclaw-gateway-1 | grep openclaw-logger`
2. Confirm the log directory exists on the host: `ls ~/.openclaw/logs/conversations/`
3. Run `./test-logger.sh` for a step-by-step diagnosis

**"stale config entry ignored" warning**
An old/broken plugin config entry is in `openclaw.json` but the plugin files can't be found. Run `./install.sh` again to reinstall to the correct path, then restart the Gateway.
