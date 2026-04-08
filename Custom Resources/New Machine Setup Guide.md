# New Machine Setup Guide

How to get the full OpenClaw + AdamClaw stack running on a new Mac from scratch. Everything here assumes you have the `Adam-Genesis-Claw` repo cloned and are starting fresh.

---

## What You're Restoring

- **OpenClaw Gateway** — runs in Docker, handles all agent orchestration
- **AdamClaw agent** — personal agent, routed via @AdamGenesisClaw_bot on Telegram
- **EveClaw agent** — second agent, routed via @EveGenesisClaw_bot on Telegram
- **openclaw-logger plugin** — logs all conversations to JSONL files

---

## Prerequisites

Install these first:

```bash
# Homebrew
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Node.js 18+ (for the logger plugin build)
brew install node

# jq (for config editing)
brew install jq

# Docker Desktop
# Download from https://www.docker.com/products/docker-desktop/
# Install and start it before continuing
```

---

## Step 1 — OpenClaw initial setup

Install OpenClaw via its official installer, then run the initial setup wizard. This creates `~/.openclaw/` and the base `openclaw.json`.

After the wizard completes, OpenClaw will be running with a default `main` agent. **Stop here** before customizing anything — the next steps layer your specific config on top.

---

## Step 2 — Configure `~/.openclaw/openclaw.json`

The wizard creates a basic config. You need to add your agents, routing, and plugins on top. Open `~/.openclaw/openclaw.json` and apply the following sections.

### Agents section

Replace the `agents` block with:

```json
"agents": {
  "defaults": {
    "model": {
      "primary": "google/gemini-2.5-flash-lite"
    },
    "sandbox": {
      "mode": "off"
    },
    "workspace": "/home/node/.openclaw/workspace",
    "models": {
      "google/gemini-2.5-flash-lite": {}
    }
  },
  "list": [
    {
      "id": "main",
      "default": true
    },
    {
      "id": "adamclaw",
      "name": "adamclaw",
      "workspace": "/home/node/.openclaw/agents/adamclaw/workspace",
      "agentDir": "/home/node/.openclaw/agents/adamclaw/agent",
      "model": "google/gemini-2.5-flash-lite",
      "thinkingDefault": "low"
    },
    {
      "id": "eveclaw",
      "name": "eveclaw",
      "workspace": "/home/node/.openclaw/agents/eveclaw/workspace",
      "agentDir": "/home/node/.openclaw/agents/eveclaw/agent",
      "model": "google/gemini-2.5-flash-lite",
      "thinkingDefault": "low"
    }
  ]
}
```

### Bindings section (top-level — not nested under agents)

Add this at the top level of `openclaw.json`:

```json
"bindings": [
  {
    "type": "route",
    "agentId": "adamclaw",
    "match": {
      "channel": "telegram",
      "accountId": "adamclaw"
    }
  },
  {
    "type": "route",
    "agentId": "eveclaw",
    "match": {
      "channel": "telegram",
      "accountId": "eveclaw"
    }
  }
]
```

### Telegram channel

Add/update the `channels.telegram` entry with both bot tokens:

```json
"channels": {
  "telegram": {
    "accounts": {
      "adamclaw": {
        "botToken": "YOUR_ADAMCLAW_BOT_TOKEN",
        "dmPolicy": "pairing"
      },
      "eveclaw": {
        "botToken": "YOUR_EVECLAW_BOT_TOKEN",
        "dmPolicy": "pairing"
      }
    },
    "defaultAccount": "adamclaw",
    "enabled": true
  }
}
```

Bot tokens come from BotFather — grab them from your secure notes. After restore, each bot requires a one-time pairing approval (see Step 6).

### openclaw-logger plugin

Add to `plugins.entries`:

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

### Google provider (if using Gemini)

```json
"plugins": {
  "entries": {
    "google": {
      "enabled": true
    }
  }
}
```

Merge this with the `openclaw-logger` entry above — `plugins.entries` is a single object.

---

## Step 3 — Restore agent workspaces

Create workspace directories and copy the backed-up files from this repo:

```bash
# AdamClaw
mkdir -p ~/.openclaw/agents/adamclaw/workspace
cp agent-configs/adamclaw/workspace/*.md ~/.openclaw/agents/adamclaw/workspace/

# EveClaw
mkdir -p ~/.openclaw/agents/eveclaw/workspace
cp agent-configs/eveclaw/workspace/*.md ~/.openclaw/agents/eveclaw/workspace/

# Shared main workspace (OpenClaw expects it)
mkdir -p ~/.openclaw/workspace
```

Each workspace restores: `SOUL.md`, `IDENTITY.md`, `AGENTS.md`, `USER.md`, `TOOLS.md`, `HEARTBEAT.md`. EveClaw also includes `BOOTSTRAP.md` for the first-run identity ritual.

---

## Step 4 — Install the openclaw-logger plugin

From the repo root:

```bash
./install.sh
```

This builds the TypeScript plugin, copies it to `~/.openclaw/extensions/openclaw-logger/`, and verifies the config entry is correct.

---

## Step 5 — Build and Start the Gateway

The compose file uses a locally built image (`openclaw:local`). `docker compose build` does nothing — you must build explicitly:

```bash
cd /Users/home/tools/Adamclaw
docker compose down
docker build -t openclaw:local .
docker compose up -d
```

The build takes several minutes on first run. The compose project is named `adamclaw` (derived from the directory name), so containers are named `adamclaw-openclaw-gateway-1` and `adamclaw-openclaw-cli-1`.

Verify it's running:

```bash
docker logs adamclaw-openclaw-gateway-1 --tail 20
```

You should see:

- `[telegram] [adamclaw] starting provider (@AdamGenesisClaw_bot)`
- `[telegram] [eveclaw] starting provider (@EveGenesisClaw_bot)`
- `[plugins] openclaw-logger: loaded without install/load-path provenance`
- `[gateway] listening on ws://...`

---

## Step 6 — Pair bots and validate

Each bot requires a one-time pairing approval after restore. Note: pairing is tied to the Telegram account ID, not the container name — if the container name changed (e.g. from `openclaw-` to `adamclaw-` prefix), existing pairings are invalidated and must be re-approved. Message each bot in Telegram — it will respond with a pairing code. Approve with:

```bash
docker exec adamclaw-openclaw-gateway-1 openclaw pairing approve telegram <CODE>
```

Then run the logger test to confirm the full stack is working end to end:

> **Note on XDG persistence:** `docker-compose.yml` sets `XDG_CONFIG_HOME=/home/node/.openclaw/.config` and `XDG_DATA_HOME=/home/node/.openclaw/.local/share`. This redirects all XDG-compliant skill CLIs (gog, etc.) to store their config inside the volume-mounted directory, so credentials survive rebuilds. This is already in the compose file — no action needed unless you're modifying the compose file from scratch.

```bash
./test-logger.sh
```

All 10 checks should pass.

**Skill CLIs (gog etc.):** After restore, any skill CLIs that require auth must be re-authorized inside the new container. The encrypted keyring files persist in `~/.openclaw/.config/` (via XDG and the volume mount), but you must re-run the token import step. See `Custom Resources/Adding a New Skill (Docker Setup).md` → Step 4 for the exact flow.

Then send a Telegram message to @AdamGenesisClaw_bot. Check the log to confirm it routed to `adamclaw`:

```bash
./view-logs.sh --tail 1
```

You should see `agent_id: adamclaw` and `channel: telegram`.

---

## Step 7 — Google API key (if using Gemini)

If OpenClaw doesn't already have your Google API key, configure it:

```bash
docker exec adamclaw-openclaw-gateway-1 sh -c "openclaw config set ..."
```

Or use the OpenClaw web UI (browser at `http://localhost:18789`) to set up the Google provider auth. Your API key lives in your secure notes.

---

## What's NOT in the Repo

These you need to source elsewhere:

| Thing                   | Where to get it                                                                         |
| ----------------------- | --------------------------------------------------------------------------------------- |
| AdamClaw bot token      | BotFather — the @AdamGenesisClaw_bot token                                              |
| EveClaw bot token       | BotFather — the @EveGenesisClaw_bot token                                               |
| Google API key          | Google AI Studio (aistudio.google.com)                                                  |
| Gateway auth token      | Regenerated automatically by OpenClaw on first run                                      |
| AdamClaw's memory files | `~/.openclaw/agents/adamclaw/workspace/memory/` — lives on your Mac only, not backed up |
| EveClaw's memory files  | `~/.openclaw/agents/eveclaw/workspace/memory/` — lives on your Mac only, not backed up  |

---

## Repo Structure Reference

```
Adam-Genesis-Claw/
├── agent-configs/
│   ├── adamclaw/
│   │   └── workspace/       ← restore to ~/.openclaw/agents/adamclaw/workspace/
│   │       ├── SOUL.md, IDENTITY.md, AGENTS.md, USER.md, TOOLS.md, HEARTBEAT.md
│   └── eveclaw/
│       └── workspace/       ← restore to ~/.openclaw/agents/eveclaw/workspace/
│           ├── SOUL.md, IDENTITY.md, AGENTS.md, USER.md, TOOLS.md, HEARTBEAT.md, BOOTSTRAP.md
├── openclaw-logger/         ← plugin source
├── install.sh               ← installs the logger plugin
├── test-logger.sh           ← validates the full stack
├── view-logs.sh             ← human-readable log viewer
└── Custom Resources/
    ├── Adding a New Agent.md
    ├── Model Compatibility Notes.md
    ├── New Machine Setup Guide.md
    ├── Plugin Development Guide.md
    ├── openclaw-logger User Guide.md
    └── Agent Personalization Fields.md
```

---

## Keeping the Backup Current

Whenever you significantly change an agent's workspace files (updating SOUL.md, AGENTS.md, etc.), sync them back to the repo:

```bash
cp ~/.openclaw/agents/adamclaw/workspace/*.md \
   /path/to/Adam-Genesis-Claw/agent-configs/adamclaw/workspace/

cp ~/.openclaw/agents/eveclaw/workspace/*.md \
   /path/to/Adam-Genesis-Claw/agent-configs/eveclaw/workspace/

cd /path/to/Adam-Genesis-Claw
git add agent-configs/
FAST_COMMIT=1 git commit -m "chore: sync agent workspace files"
git push
```

The `memory/` subdirectory inside each workspace is intentionally not backed up — it contains session-specific notes only meaningful in context. The personality files (SOUL, AGENTS, IDENTITY) are the important ones.
