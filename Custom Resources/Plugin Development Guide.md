# OpenClaw Plugin Development Guide

Hard-won learnings from building `openclaw-logger`. Written to make the next plugin a one-shot build.

---

## The Four Things That Must Be Right

Every plugin needs these four things correct before the Gateway will load it. Getting any one wrong produces a silent failure or crash loop.

### 1. Install location

Plugins must live at:

```
~/.openclaw/extensions/<plugin-id>/
```

Not `~/.openclaw/plugins/` (that path is ignored). Not anywhere else.

Inside the Docker container this maps to:

```
/home/node/.openclaw/extensions/<plugin-id>/
```

Source: `src/plugins/roots.ts` → `resolvePluginSourceRoots()` → `global: path.join(resolveConfigDir(env), "extensions")`

### 2. `openclaw.plugin.json` manifest

Every plugin directory **must** contain an `openclaw.plugin.json` file. Without it the Gateway skips the plugin entirely — no warning, it just isn't loaded.

Minimum viable manifest:

```json
{
  "id": "your-plugin-id",
  "name": "Human Readable Name",
  "description": "What it does.",
  "configSchema": {
    "type": "object",
    "additionalProperties": false,
    "properties": {}
  }
}
```

If your plugin accepts config values (like `logDir`), declare them in `configSchema.properties`:

```json
"configSchema": {
  "type": "object",
  "additionalProperties": false,
  "properties": {
    "logDir": { "type": "string" }
  }
}
```

The `configSchema` key is **required** even if empty. The Gateway will refuse to load a plugin without it.

### 3. `package.json` entry point declaration

The Gateway discovers your entry point via `package.json`'s `openclaw.extensions` array — **not** via `openclaw.plugin.json`. These are two separate lookups.

```json
{
  "name": "your-plugin-id",
  "type": "module",
  "openclaw": {
    "extensions": ["./dist/index.js"]
  }
}
```

Common mistakes:

- `"openclaw": { "plugin": { "hooks": [...] } }` — **wrong key**, Gateway ignores it
- No `openclaw` field at all — Gateway falls back to looking for `index.js` at the package root, which won't exist if you build to `dist/`

### 4. `openclaw.json` config entry

```json
"plugins": {
  "entries": {
    "your-plugin-id": {
      "enabled": true,
      "config": {
        "yourConfigKey": "value"
      }
    }
  }
}
```

The plugin entry schema is **strict** (`additionalProperties: false`). Only these keys are valid under a plugin entry:

- `enabled`
- `hooks`
- `subagent`
- `config`

Do **not** add `env`, `options`, or any other key — the Gateway will reject the entire config and crash-loop on startup.

---

## Plugin Entry Point Structure

```typescript
import { definePluginEntry } from 'openclaw/plugin-sdk/core';
import type { OpenClawPluginApi } from 'openclaw/plugin-sdk/core';

export default definePluginEntry({
  id: 'your-plugin-id',   // must match openclaw.plugin.json id
  name: 'Display Name',
  description: 'What it does.',
  register(api: OpenClawPluginApi) {
    // Instantiate anything that needs api.pluginConfig HERE, not at module level.
    // Module-level code runs before register() is called, so api is not yet available.
    const myService = new MyService(api.pluginConfig);

    api.on('message_received', async (event, ctx) => { ... });
    api.on('llm_input', async (event, ctx) => { ... });
    api.on('llm_output', async (event, ctx) => { ... });
    api.on('agent_end', async (event, ctx) => { ... });
    api.on('message_sent', async (event, ctx) => { ... });
  },
});
```

**Critical:** `api.pluginConfig` is only available inside `register()`. Never instantiate classes that need config at module top level.

---

## Hook Event Reference

The hook types are **not exported** from `openclaw/plugin-sdk/core`. Define them locally:

```typescript
// message_received
interface HookMessageContext {
  channelId: string;
  accountId?: string;
  conversationId?: string;
}
interface HookMessageReceivedEvent {
  from: string;
  content: string;
  timestamp?: number;
  metadata?: Record<string, unknown>;
}

// message_sent
interface HookMessageSentEvent {
  to: string;
  content: string;
  success: boolean;
  error?: string;
}

// llm_input, llm_output, agent_end
interface HookAgentContext {
  runId?: string;
  agentId?: string;
  sessionKey?: string;
  sessionId?: string;
  workspaceDir?: string;
  messageProvider?: string;
  trigger?: string;
  channelId?: string;
}
interface HookLlmInputEvent {
  runId: string;
  sessionId: string;
  provider: string;
  model: string; // note: field is "model" on event, NOT "modelId"
  systemPrompt?: string;
  prompt: string;
  historyMessages: unknown[];
  imagesCount: number;
}
interface HookLlmOutputEvent {
  runId: string;
  sessionId: string;
  provider: string;
  model: string;
  assistantTexts: string[]; // array of text blocks
  lastAssistant?: unknown; // raw message object (use for thinking content)
  usage?: {
    input?: number;
    output?: number;
    cacheRead?: number;
    cacheWrite?: number;
    total?: number;
  };
}
interface HookAgentEndEvent {
  messages: unknown[];
  success: boolean;
  error?: string;
  durationMs?: number;
}
```

---

## Hook Firing Order

This is the most important architectural fact for any stateful plugin:

```
message_received   (no sessionId — only channelId available)
llm_input          (sessionId + runId available)
agent_end          (fires FIRST among the two output hooks)
llm_output         (fires AFTER agent_end)
message_sent       (no sessionId — only channelId available)
```

**`agent_end` fires before `llm_output`.** Both are fire-and-forget (non-awaited) from the Gateway's perspective. If you write data to disk in `onAgentEnd`, you will not have `response_text`, `input_tokens`, or `output_tokens` yet — they arrive in `onLlmOutput`.

The correct write strategy for any plugin that needs both end metadata (latency, status) and LLM output data (tokens, response):

```
onAgentEnd  → store end metadata in partial; set _agentEnded = true; do NOT write
onLlmOutput → store output data; if _agentEnded, write final entry and delete partial
stale sweep → write incomplete entries after TTL (handles runs where llm_output never fires)
```

---

## Correlation: Connecting Events to the Same Run

`message_received` and `message_sent` do **not** include `sessionId`. Use `channelId` as a bridge key:

```typescript
// message_received → store by channelId
pendingMessages.set(ctx.channelId, { content: event.content, ... });

// llm_input → drain the pending message for this channel
const pending = pendingMessages.get(ctx.channelId);
pendingMessages.delete(ctx.channelId);
// merge pending.content into the run entry
```

All other hooks (`llm_input`, `llm_output`, `agent_end`) share `sessionId` + `runId`. Use these as a compound key:

```typescript
const key = runId ? `${sessionId}:${runId}` : sessionId;
```

---

## TypeScript Setup

```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "strict": true,
    "esModuleInterop": true
  },
  "include": ["src"]
}
```

```json
// package.json
{
  "type": "module",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc"
  },
  "openclaw": {
    "extensions": ["./dist/index.js"]
  },
  "devDependencies": {
    "openclaw": "*",
    "typescript": "^5.0.0"
  },
  "peerDependencies": {
    "openclaw": "*"
  }
}
```

Put `openclaw` in `devDependencies` and `peerDependencies`. Do **not** put it in `dependencies` — the runtime resolves `openclaw/plugin-sdk` via its own alias system, and having it in `dependencies` causes install issues.

---

## install.sh Pattern

```bash
INSTALL_TARGET="$HOME/.openclaw/extensions/your-plugin-id"
CONFIG_FILE="$HOME/.openclaw/openclaw.json"

# 1. Build
cd /path/to/plugin/source
npm install --silent
npm run build

# 2. Copy to extensions/
mkdir -p "$INSTALL_TARGET"
rsync -a --delete \
  --exclude='node_modules/.cache' \
  --exclude='src/' \
  --exclude='*.ts' \
  --exclude='.git' \
  /path/to/plugin/source/ "$INSTALL_TARGET/"

cd "$INSTALL_TARGET"
npm install --omit=dev --silent

# 3. Write config (validate before and after)
if ! jq empty "$CONFIG_FILE" 2>/dev/null; then
  echo "ERROR: openclaw.json is not valid JSON"
  exit 1
fi

UPDATED=$(jq \
  --arg val "your-value" \
  '.plugins //= {} |
   .plugins.entries //= {} |
   .plugins.entries["your-plugin-id"] = {
     "enabled": true,
     "config": { "yourKey": $val }
   }' "$CONFIG_FILE")

if ! echo "$UPDATED" | jq empty 2>/dev/null; then
  echo "ERROR: Config merge produced invalid JSON"
  exit 1
fi

echo "$UPDATED" > "$CONFIG_FILE"

# 4. Restart reminder
echo "Restart the Gateway container to activate the plugin."
```

Key rules:

- Always validate `openclaw.json` **before** touching it
- Always validate the merged result **before** writing it
- Use `config: { ... }` for plugin settings, never `env: { ... }`
- After modifying `openclaw.json`, the Gateway must restart to pick up the change

---

## The Docker Volume Constraint

The Gateway runs in Docker. The only directory bind-mounted from host → container is `~/.openclaw/`. If your plugin reads or writes files, they **must** live inside `~/.openclaw/` or they will not be accessible from the container.

Host path → Container path:

```
~/.openclaw/  →  /home/node/.openclaw/
```

When configuring a file path (e.g. `logDir`), store the container-side path in config:

```
/home/node/.openclaw/logs/conversations
```

The plugin code resolves `~` expansion via `os.homedir()` inside the container, which returns `/home/node`.

---

## Iterating After First Install

For code-only changes (no config changes):

```bash
cd /path/to/plugin/source
npm run build
cp -r dist/ ~/.openclaw/extensions/your-plugin-id/dist/
# Restart Gateway container
```

`install.sh` is only needed for the first install or when `openclaw.json` config needs updating.

---

## Diagnosing Load Failures

```bash
docker logs adamclaw-openclaw-gateway-1 2>&1 | grep -i "your-plugin-id"
```

| Log message                                                     | Cause                                                                           | Fix                                         |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------- |
| `plugin not found: your-plugin-id (stale config entry ignored)` | Plugin is in config but files not found                                         | Reinstall to `extensions/` (not `plugins/`) |
| `plugin manifest not found`                                     | `openclaw.plugin.json` missing                                                  | Add it with `id` + `configSchema`           |
| `plugin manifest requires configSchema`                         | `openclaw.plugin.json` exists but missing `configSchema` key                    | Add `"configSchema": {}`                    |
| `Unrecognized key: "env"`                                       | Config entry has invalid key                                                    | Use `config: {}` not `env: {}`              |
| `openclaw-logger: loaded without install/load-path provenance`  | Working but untracked (normal for local dev)                                    | Ignore or pin in `plugins.allow`            |
| Plugin loads but does nothing                                   | Handler instantiated outside `register()` so `api.pluginConfig` was unavailable | Move instantiation inside `register(api)`   |

---

## Quick Checklist for a New Plugin

- [ ] Source builds with `npm run build` (no TypeScript errors)
- [ ] Installed to `~/.openclaw/extensions/<id>/` (not `plugins/`)
- [ ] `openclaw.plugin.json` present with `id` + `configSchema`
- [ ] `package.json` has `"openclaw": { "extensions": ["./dist/index.js"] }`
- [ ] `openclaw.json` entry uses `config: {}` not `env: {}`
- [ ] `openclaw.json` was validated as valid JSON after editing
- [ ] Plugin class/service instantiated inside `register(api)`, not at module level
- [ ] If correlating across hooks: using `channelId` bridge for `message_received`/`message_sent`, and `sessionId:runId` key for others
- [ ] If writing data after a run: writing in `onLlmOutput` (not `onAgentEnd`), since `agent_end` fires first
- [ ] Gateway container restarted after install
- [ ] `docker logs` checked to confirm plugin loaded without errors
