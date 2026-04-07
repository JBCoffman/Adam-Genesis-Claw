# PRD: OpenClaw LLM Conversation Logger Plugin

**Version:** 2.0  
**Status:** Ready for Implementation  
**Target:** AI Coding Agent (one-shot build)  
**Replaces:** v1.0 proxy sidecar approach

---

## Overview

This document specifies the complete build of a native OpenClaw plugin that logs all LLM conversations to disk using OpenClaw's first-class plugin hook system. The plugin runs inside the OpenClaw Gateway process, tapping into structured lifecycle events to capture user requests, model inputs, reasoning/thinking content, responses, and usage metadata — with zero network interception, zero changes to docker-compose, and zero changes to OpenClaw's source code.

The user's Docker Desktop Play/Stop workflow is completely unchanged. The plugin is installed once via CLI and runs automatically on every subsequent gateway start.

---

## Required Variables

Only one value is unknown at PRD authoring time:

| Variable              | Description                                                                                  | Used In                        |
| --------------------- | -------------------------------------------------------------------------------------------- | ------------------------------ |
| `{{LOG_OUTPUT_PATH}}` | Absolute path on the host Mac where log files should land (e.g. `/Users/jake/openclaw-logs`) | Volume mount and plugin config |

Everything else — model name, API key location, docker-compose structure, openclaw.json contents — is **not needed** for this build. The plugin operates inside the process and inherits all of that automatically.

---

## Goals

- Capture every LLM conversation turn with full payload fidelity
- Log: timestamp, session ID, agent ID, channel, user request, full assembled prompt context, thinking/reasoning content, final response text, token counts, model used, and latency
- Zero changes to OpenClaw source code
- Zero changes to docker-compose.yml
- Zero changes to Gateway networking or LLM provider routing
- Logs persist on the host machine at `{{LOG_OUTPUT_PATH}}`
- Plugin failure must never affect OpenClaw's normal operation — all hook handlers are fire-and-forget

## Non-Goals

- A log viewer UI (out of scope for v1)
- Log rotation or archival beyond basic date-stamped JSONL files
- Filtering or redacting log content
- Supporting multiple simultaneous log formats
- Any modification to OpenClaw's session database or internal state

---

## Architecture

```
OpenClaw Gateway Process
│
├── message:received hook  ──► captures raw user input + channel metadata
├── llm_input hook         ──► captures assembled prompt, model, thinking config
├── llm_output hook        ──► captures response text, token counts
├── agent_end hook         ──► captures run duration, final status
│
└── Logger Plugin
        │
        ▼
  ~/.openclaw/hooks/openclaw-logger/
        │
        ▼
  {{LOG_OUTPUT_PATH}}/openclaw-YYYY-MM-DD.jsonl  (host-mounted volume)
```

No proxy. No network interception. No Gemini API format parsing. The plugin receives structured TypeScript objects directly from the Gateway event bus.

---

## How OpenClaw Hooks Work (Context for the Agent)

Hooks are TypeScript files placed in `~/.openclaw/hooks/<hook-name>/` containing two files:

- `HOOK.md` — metadata frontmatter declaring the hook name, description, and which events it listens to
- `handler.ts` — the TypeScript handler function, exported as default

Plugin hooks (the richer set, used here) are registered via the Plugin SDK and support the full `llm_input` / `llm_output` / `agent_end` event surface that internal hooks do not expose.

The implementing agent must determine whether to build this as:

- **A standalone managed hook** (`~/.openclaw/hooks/`) — simpler, uses the internal hook event system, gets `message:received`, `message:sent`, `agent_end`, but does NOT get `llm_input` / `llm_output`
- **A full plugin** — required to access `llm_input` and `llm_output`, which fire immediately before/after the LLM API call with the full prompt payload

**Decision: Build as a full plugin.** `llm_input` and `llm_output` are essential for capturing thinking/reasoning content and the assembled prompt — the core value of this tool. The standalone hook system does not expose these events.

---

## Deliverables

The agent must produce the following files, ready to use with no further editing:

### 1. `openclaw-logger/package.json`

Plugin package manifest declaring the plugin identity and hook entry points.

### 2. `openclaw-logger/src/index.ts`

Plugin entry point that registers all hook handlers with the OpenClaw Plugin SDK.

### 3. `openclaw-logger/src/logger.ts`

Core logging logic: log entry assembly, file I/O, correlation, and JSONL writing.

### 4. `openclaw-logger/src/types.ts`

TypeScript types for the log entry schema and internal state.

### 5. `openclaw-logger/tsconfig.json`

TypeScript config for building the plugin.

### 6. `openclaw-logger/README.md`

Human-readable install and usage instructions. Must be self-contained — someone should be able to follow it with no other context.

### 7. `install.sh`

One-shot install script. Builds the plugin, installs it into OpenClaw, and enables it. User runs this once, then restarts the Gateway.

### 8. `test-logger.sh`

Validation script the user runs after install to confirm the plugin is wired correctly before sending a real message through OpenClaw.

---

## Plugin Hook Registration

The plugin registers handlers for the following hooks in `src/index.ts`:

```typescript
// Hooks to register (in priority order):
"message_received"; // inbound user message — captures raw input + channel
"llm_input"; // pre-LLM call — captures assembled prompt, model, thinking config
"llm_output"; // post-LLM response — captures response text, token counts
"agent_end"; // run complete — captures latency, final status
"message_sent"; // outbound reply — captures final delivered text
```

All handlers are **parallel** (fire-and-forget). They must never throw — wrap all logic in try/catch and log errors to stderr only.

---

## Log Entry Schema

Each conversation turn produces one JSONL entry, assembled by correlating events via `sessionId` and `runId`. The entry is written when `agent_end` fires (at which point all other fields are available).

```typescript
interface LogEntry {
  // Identity
  timestamp: string; // ISO 8601 UTC — when agent_end fired
  run_id: string; // Unique per agent run, used for correlation
  session_id: string; // OpenClaw session UUID
  session_key: string; // Human-readable session key (e.g. "agent:main:main")
  agent_id: string; // Resolved agent ID
  channel: string; // e.g. "whatsapp", "telegram", "discord", "webchat"

  // Request
  user_message: string; // Raw inbound message text (from message_received)
  sender_id: string | null; // Sender identifier from the channel
  conversation_id: string | null; // Channel conversation/chat ID

  // LLM Input
  model: string; // e.g. "gemini-2.5-pro"
  provider: string; // e.g. "google"
  system_prompt_preview: string; // First 500 chars of assembled system prompt
  full_prompt_char_count: number; // Total character count of assembled prompt
  thinking_enabled: boolean; // Whether thinking/reasoning mode was active
  thinking_level: string | null; // e.g. "high", "medium", "low", null

  // LLM Output
  response_text: string; // Full model response text
  thinking_content: string | null; // Reasoning/thinking block text if present, else null
  input_tokens: number | null;
  output_tokens: number | null;
  total_tokens: number | null;

  // Run metadata
  latency_ms: number; // Total agent run duration
  status: "ok" | "error"; // From agent_end
  error: string | null; // Error message if status is 'error'

  // Delivery
  delivered_text: string | null; // Final text actually sent back to user (from message_sent)
}
```

---

## Log File Behavior

**File naming:** `openclaw-YYYY-MM-DD.jsonl` — date in UTC, new file per calendar day.

**Location:** The plugin reads its log directory from an environment variable `OPENCLAW_LOGGER_DIR`. This is set in the plugin config in `~/.openclaw/openclaw.json`. Default fallback: `~/.openclaw/logs/conversations/`.

**Write behavior:** One `JSON.stringify(entry) + "\n"` write per completed run, flushed immediately. Appends to existing file. No locking needed — OpenClaw serializes runs per session so concurrent writes to the same session are impossible; cross-session concurrent writes to the same file are handled by appending (last-write-wins per line, JSONL is inherently append-safe).

**Directory creation:** Plugin creates the log directory on startup if it does not exist. Startup failure to create the directory logs a warning to stderr and disables logging for the session — it does not crash the Gateway.

---

## Event Correlation Strategy

Multiple events fire per agent run. They must be correlated into a single log entry. Strategy:

1. **In-memory map** keyed by `sessionId + runId` (or `sessionId` if `runId` is unavailable from a given hook's context)
2. `message_received` fires first — creates a new partial entry in the map
3. `llm_input` fires — enriches the entry with model/prompt data; if no entry exists for this session yet (e.g. the run was not user-triggered), creates one
4. `llm_output` fires — enriches with response text and token counts
5. `message_sent` fires — enriches with delivered text
6. `agent_end` fires — adds latency and status, then **writes the completed entry to disk and removes it from the map**

**Timeout cleanup:** Entries that never reach `agent_end` (e.g. aborted runs) are written with `status: 'error'` and `error: 'run_did_not_complete'` after a 10-minute TTL. A `setInterval` running every 60 seconds checks for stale entries.

**Multi-turn consideration:** Each user message triggers a new run. The map naturally handles concurrent sessions (different sessionIds) and sequential turns (same sessionId, different runId).

---

## Plugin Config in openclaw.json

The `install.sh` script must append the following to `~/.openclaw/openclaw.json` (or create it if absent), merging with existing content:

```json
{
  "plugins": {
    "allow": ["openclaw-logger"],
    "entries": {
      "openclaw-logger": {
        "enabled": true,
        "env": {
          "OPENCLAW_LOGGER_DIR": "{{LOG_OUTPUT_PATH}}"
        }
      }
    }
  }
}
```

The install script must handle the case where `plugins` key already exists and merge correctly (not overwrite). Use `jq` for JSON manipulation if available, otherwise provide manual instructions in the README.

---

## install.sh Specification

The install script must perform these steps in order, with clear console output at each step:

1. Check that `node` (v18+) and `npm` are available
2. Check that `openclaw` CLI is available and the Gateway is reachable (`openclaw health`)
3. `cd` into the `openclaw-logger` directory
4. Run `npm install` to install dependencies
5. Run `npm run build` to compile TypeScript to `dist/`
6. Copy or symlink the built plugin into `~/.openclaw/plugins/openclaw-logger/`
7. Merge the plugin config block into `~/.openclaw/openclaw.json` using `jq` (or manual merge instructions if `jq` is unavailable)
8. Run `openclaw plugins list` to confirm the plugin appears
9. Print final instructions: "Restart your OpenClaw Gateway (stop and start in Docker Desktop) to activate the logger."

If any step fails, print a clear error and exit. Do not continue past a failed step.

---

## test-logger.sh Specification

The test script validates the plugin is wired correctly **after** the Gateway has been restarted with the plugin active. It must:

1. Check that the Gateway is running (`openclaw health`)
2. Check that the plugin appears as enabled (`openclaw plugins list`)
3. Send a test message through the agent CLI: `openclaw agent --message "Logger test ping — please reply with the word PONG"`
4. Wait up to 30 seconds for the agent to respond
5. Check that `{{LOG_OUTPUT_PATH}}/openclaw-YYYY-MM-DD.jsonl` exists and was modified in the last 60 seconds
6. Parse and pretty-print the last log entry using `jq` (or `node -e` if `jq` unavailable)
7. Validate that `user_message`, `response_text`, `model`, and `session_id` are all non-empty in that entry
8. Print PASS with the entry summary, or FAIL with what was missing

---

## File Structure

```
openclaw-logger/
├── src/
│   ├── index.ts          ← plugin entry point, hook registration
│   ├── logger.ts         ← log entry assembly, file I/O, correlation map
│   └── types.ts          ← LogEntry interface, internal state types
├── package.json          ← plugin manifest with openclaw plugin metadata
├── tsconfig.json
└── README.md

install.sh                ← one-shot install (run from parent dir)
test-logger.sh            ← post-install validation
```

---

## package.json Specification

```json
{
  "name": "openclaw-logger",
  "version": "1.0.0",
  "description": "Logs all OpenClaw LLM conversations to JSONL files",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch"
  },
  "openclaw": {
    "plugin": {
      "id": "openclaw-logger",
      "name": "Conversation Logger",
      "description": "Logs all LLM conversations (input, output, thinking, tokens, latency) to JSONL",
      "hooks": ["./dist/index.js"]
    }
  },
  "devDependencies": {
    "typescript": "^5.0.0"
  }
}
```

The `openclaw.plugin.hooks` array tells OpenClaw where to find the hook registration entry point.

---

## src/index.ts Specification

The entry point must:

1. Import the OpenClaw Plugin SDK (package: `@openclaw/plugin-sdk` or the equivalent available import — the implementing agent must verify the correct import path from the OpenClaw plugin documentation or source)
2. Import `Logger` from `./logger`
3. Instantiate `Logger` once (singleton, not per-event)
4. Export a default plugin registration function that registers handlers for all five hooks
5. Each handler must be a thin wrapper that calls the Logger instance method and catches all errors

```typescript
// Pseudocode structure — agent must use correct OpenClaw Plugin SDK API
import { definePlugin } from "@openclaw/plugin-sdk"; // verify actual package name
import { Logger } from "./logger";

const logger = new Logger();

export default definePlugin({
  id: "openclaw-logger",
  hooks: {
    message_received: async (ctx) => {
      try {
        await logger.onMessageReceived(ctx);
      } catch (e) {
        console.error("[openclaw-logger] message_received error:", e);
      }
    },
    llm_input: async (ctx) => {
      try {
        await logger.onLlmInput(ctx);
      } catch (e) {
        console.error("[openclaw-logger] llm_input error:", e);
      }
    },
    llm_output: async (ctx) => {
      try {
        await logger.onLlmOutput(ctx);
      } catch (e) {
        console.error("[openclaw-logger] llm_output error:", e);
      }
    },
    agent_end: async (ctx) => {
      try {
        await logger.onAgentEnd(ctx);
      } catch (e) {
        console.error("[openclaw-logger] agent_end error:", e);
      }
    },
    message_sent: async (ctx) => {
      try {
        await logger.onMessageSent(ctx);
      } catch (e) {
        console.error("[openclaw-logger] message_sent error:", e);
      }
    },
  },
});
```

**Critical:** The agent must look up the actual OpenClaw Plugin SDK import path and `definePlugin` API shape from the OpenClaw source or documentation before writing this file. Do not guess. If the SDK is not a separate npm package, the hooks may be registered differently — check `src/plugins/` in the OpenClaw repo.

---

## src/logger.ts Specification

### Constructor

- Reads `OPENCLAW_LOGGER_DIR` from `process.env`, falls back to `~/.openclaw/logs/conversations/`
- Expands `~` to `os.homedir()`
- Creates directory with `fs.mkdirSync(dir, { recursive: true })` — logs warning to stderr if it fails, sets `this.disabled = true`
- Initializes `this.runs = new Map<string, Partial<LogEntry>>()`
- Starts stale-entry cleanup interval (10-minute TTL, checked every 60 seconds)

### Key generation

```typescript
private key(sessionId: string, runId?: string): string {
  return runId ? `${sessionId}:${runId}` : sessionId;
}
```

### onMessageReceived(ctx)

Extract from context: `sessionId`, `sessionKey`, `agentId`, `channelId`, `from` (senderId), `conversationId`, `content` (user message text), `timestamp`.
Create or update partial entry in `this.runs`.

### onLlmInput(ctx)

Extract: `sessionId`, `runId`, `model`, `provider`, system prompt text (preview + char count), `thinkingLevel`, `thinkingEnabled`.
Update partial entry.

### onLlmOutput(ctx)

Extract: `sessionId`, `runId`, response text, thinking/reasoning block (if present), `inputTokens`, `outputTokens`, `totalTokens`.
Update partial entry.

### onMessageSent(ctx)

Extract: `sessionId`, delivered text content.
Update partial entry.

### onAgentEnd(ctx)

Extract: `sessionId`, `runId`, `durationMs`, `status` ('ok' | 'error'), `error` (if present).
Finalize the entry: fill any missing fields with null, set `timestamp` to now, set `latency_ms`.
Call `this.write(entry)`.
Remove entry from `this.runs`.

### write(entry: LogEntry)

```typescript
private write(entry: LogEntry): void {
  if (this.disabled) return;
  const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD UTC
  const filename = path.join(this.logDir, `openclaw-${date}.jsonl`);
  const line = JSON.stringify(entry) + '\n';
  fs.appendFileSync(filename, line, 'utf8');
}
```

Use `appendFileSync` — synchronous to avoid partial-write races. At ~1KB per entry this is negligible latency impact.

### Stale entry cleanup

```typescript
setInterval(() => {
  const cutoff = Date.now() - 10 * 60 * 1000;
  for (const [key, entry] of this.runs.entries()) {
    if (entry._createdAt && entry._createdAt < cutoff) {
      this.write({
        ...entry,
        status: "error",
        error: "run_did_not_complete",
        timestamp: new Date().toISOString(),
      } as LogEntry);
      this.runs.delete(key);
    }
  }
}, 60_000).unref(); // .unref() so this doesn't keep the process alive
```

---

## README.md Required Sections

1. **What this does** — one paragraph, plain English
2. **Prerequisites** — Node 18+, OpenClaw installed and running
3. **Install** — `./install.sh` and then restart Gateway
4. **Verify** — `./test-logger.sh`
5. **Where logs go** — explain the `{{LOG_OUTPUT_PATH}}` path and JSONL format
6. **Log entry fields** — table of every field with description
7. **Viewing logs** — example `tail`, `cat | jq .`, and filter commands
8. **Uninstall** — how to disable the plugin and remove the config entry
9. **Troubleshooting** — what to check if logs aren't appearing (Gateway not restarted, plugin not enabled, log dir permissions)

---

## Implementation Notes for the Agent

- **Verify the Plugin SDK API before writing any code.** Check `packages/plugin-sdk/` or equivalent in the OpenClaw repo for the actual export names and hook context shapes. The pseudocode above is structural — the exact API may differ.
- **The `llm_input` and `llm_output` context shapes are not fully documented publicly.** The agent must inspect the OpenClaw source (search for `llm_input` in `src/`) to find the actual fields available in these hook contexts before writing the extraction logic.
- **TypeScript strict mode** — enable `strict: true` in tsconfig. No `any` types except where the SDK context type is genuinely unknown.
- **Node built-ins only** — `fs`, `path`, `os`. No third-party runtime dependencies. This keeps the plugin lightweight and eliminates npm audit surface.
- **Do not use async file I/O for log writes** — `appendFileSync` is correct here. The handlers are async but the write itself should be synchronous for simplicity and reliability.
- **The `_createdAt` field** on partial entries is internal bookkeeping for TTL cleanup. It must not appear in the final written `LogEntry`.
- **Test that `.unref()` is called on the cleanup interval** — otherwise the interval will prevent the Node process from exiting cleanly when the Gateway shuts down.

---

## Acceptance Criteria

The build is complete and correct when:

- [ ] `./install.sh` runs end to end without errors on a Mac with OpenClaw installed
- [ ] `openclaw plugins list` shows `openclaw-logger` as enabled after install
- [ ] Gateway restarts cleanly with the plugin loaded (no startup errors in `openclaw logs`)
- [ ] `./test-logger.sh` sends a test message and finds a valid JSONL entry
- [ ] The log entry contains non-empty values for: `user_message`, `response_text`, `model`, `session_id`, `channel`, `timestamp`, `latency_ms`
- [ ] `thinking_content` is `null` for a normal (non-thinking) request
- [ ] If a request is made with thinking enabled (`--thinking high` via CLI), `thinking_content` is populated and `thinking_enabled` is `true`
- [ ] Stopping the Gateway does not produce a corrupted log file
- [ ] If the log directory is missing or unwriteable, the Gateway still starts and operates normally — only logging is silently disabled
- [ ] No OpenClaw source files were modified
- [ ] No changes to docker-compose.yml were required
