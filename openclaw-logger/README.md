# openclaw-logger

A native OpenClaw plugin that logs every LLM conversation to disk as newline-delimited JSON (JSONL). It taps directly into the OpenClaw Gateway event bus — no proxy, no network interception, no changes to docker-compose.

## What this does

Every time an agent completes a run, this plugin writes one JSON line to a date-stamped file. That line captures the inbound user message, the assembled prompt (preview + character count), the full model response, any thinking/reasoning content, token usage, latency, and metadata about the session and channel. Logs survive Gateway restarts and accumulate until you choose to archive or delete them.

## Prerequisites

- Node.js 18 or later
- OpenClaw installed and the Gateway reachable (`openclaw health` returns OK)
- `jq` recommended for the install script and log inspection (falls back to `node -e` if absent)

## Install

```bash
./install.sh /path/to/your/log/directory
```

For example:

```bash
./install.sh ~/openclaw-logs
```

If you omit the path, logs default to `~/.openclaw/logs/conversations/`.

After the script completes, **restart your OpenClaw Gateway** (stop and start in Docker Desktop, or via the OpenClaw Mac app). The plugin activates on the next Gateway start.

## Verify

Once the Gateway is back up:

```bash
./test-logger.sh /path/to/your/log/directory
```

This sends a test message through the agent and checks that a valid log entry was written.

## Where logs go

Logs are written to the directory you specified at install time. A new file is created each UTC calendar day:

```
/path/to/your/log/directory/
├── openclaw-2026-04-06.jsonl
├── openclaw-2026-04-07.jsonl
└── ...
```

Each line is a single JSON object representing one completed agent run.

## Log entry fields

| Field                    | Description                                                      |
| ------------------------ | ---------------------------------------------------------------- |
| `timestamp`              | ISO 8601 UTC timestamp when the run completed                    |
| `run_id`                 | Unique identifier for this agent run                             |
| `session_id`             | OpenClaw session UUID                                            |
| `session_key`            | Human-readable session key (e.g. `agent:main:main`)              |
| `agent_id`               | The agent that handled this run                                  |
| `channel`                | Messaging channel (e.g. `telegram`, `discord`, `whatsapp`)       |
| `user_message`           | Raw inbound message text                                         |
| `sender_id`              | Sender identifier from the channel                               |
| `conversation_id`        | Channel conversation or chat ID                                  |
| `model`                  | LLM model used (e.g. `claude-opus-4-6`)                          |
| `provider`               | Provider name (e.g. `anthropic`, `google`)                       |
| `system_prompt_preview`  | First 500 characters of the assembled system prompt              |
| `full_prompt_char_count` | Total character count of the assembled prompt                    |
| `thinking_enabled`       | Whether thinking/reasoning mode was active (derived from output) |
| `thinking_level`         | Thinking level config if available, otherwise `null`             |
| `response_text`          | Full model response text                                         |
| `thinking_content`       | Reasoning/thinking block text if present, otherwise `null`       |
| `input_tokens`           | Input token count, or `null` if not reported                     |
| `output_tokens`          | Output token count, or `null` if not reported                    |
| `total_tokens`           | Total token count, or `null` if not reported                     |
| `latency_ms`             | Total agent run duration in milliseconds                         |
| `status`                 | `"ok"` or `"error"`                                              |
| `error`                  | Error message if `status` is `"error"`, otherwise `null`         |
| `delivered_text`         | Final text actually delivered back to the user                   |

## Viewing logs

Tail the current day's log as it updates:

```bash
tail -f ~/openclaw-logs/openclaw-$(date -u +%Y-%m-%d).jsonl
```

Pretty-print the last entry:

```bash
tail -1 ~/openclaw-logs/openclaw-$(date -u +%Y-%m-%d).jsonl | jq .
```

Show only model, token counts, and latency for all entries today:

```bash
cat ~/openclaw-logs/openclaw-$(date -u +%Y-%m-%d).jsonl | jq '{model, input_tokens, output_tokens, latency_ms}'
```

Find all entries where thinking was active:

```bash
cat ~/openclaw-logs/openclaw-$(date -u +%Y-%m-%d).jsonl | jq 'select(.thinking_enabled == true)'
```

Find errors:

```bash
cat ~/openclaw-logs/openclaw-$(date -u +%Y-%m-%d).jsonl | jq 'select(.status == "error")'
```

## Uninstall

1. Disable the plugin:

   ```bash
   openclaw plugins disable openclaw-logger
   ```

2. Remove the plugin entry from `~/.openclaw/openclaw.json` (delete the `openclaw-logger` key under `plugins.entries` and remove it from `plugins.allow`).

3. Optionally remove the installed plugin files:

   ```bash
   rm -rf ~/.openclaw/plugins/openclaw-logger
   ```

4. Restart the Gateway to apply.

## Troubleshooting

**Logs are not appearing after install:**

- Did you restart the Gateway after running `install.sh`? The plugin only activates on startup.
- Run `openclaw plugins list` — confirm `openclaw-logger` shows as `enabled`.
- Check Gateway logs for startup errors: `openclaw logs` or `tail /tmp/openclaw-gateway.log`.

**Permission error on the log directory:**

- Ensure the directory path is writable by the user running the Gateway process.
- Check: `ls -la /path/to/log/directory`

**`user_message` is null in some entries:**

- This field is populated via a best-effort correlation between the `message_received` and `llm_input` events. It may be null for heartbeat-triggered runs or runs initiated without a preceding user message.

**`delivered_text` is null:**

- Similar best-effort correlation. Available for user-facing channel replies; may be absent for CLI-triggered runs or internal sessions.
