# New Machine Setup Guide

How to get the full OpenClaw + AdamClaw stack running on a new Mac from scratch. Everything here assumes you have the `Adam-Genesis-Claw` repo cloned and are starting fresh.

---

## What You're Restoring

- **OpenClaw Gateway** — runs in Docker, handles all agent orchestration
- **AdamClaw agent** — your personal agent, routed via Telegram
- **openclaw-logger plugin** — logs all conversations to JSONL files
- **Telegram connection** — existing bot (@AdamGenesisClaw_bot) pointed at AdamClaw

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
      "models": {
        "google/gemini-2.5-flash-lite": {
          "thinking": { "level": "low" }
        }
      }
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
      "accountId": "default"
    }
  }
]
```

This routes your Telegram bot traffic to AdamClaw specifically, leaving `main` as the default for all other channels.

### Telegram channel

Add/update the `channels.telegram` entry with your bot token:

```json
"channels": {
  "telegram": {
    "dmPolicy": "pairing",
    "enabled": true,
    "botToken": "YOUR_TELEGRAM_BOT_TOKEN"
  }
}
```

Your Telegram bot token comes from BotFather. The existing bot (@AdamGenesisClaw_bot) — just grab the token from your secure notes.

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

## Step 3 — Restore AdamClaw's workspace

Create the workspace directory and copy the backed-up files from this repo:

```bash
mkdir -p ~/.openclaw/agents/adamclaw/workspace
cp agent-configs/adamclaw/workspace/*.md ~/.openclaw/agents/adamclaw/workspace/
```

This restores:

- `SOUL.md` — who AdamClaw is
- `IDENTITY.md` — name, emoji, creature, vibe
- `AGENTS.md` — behavioral rules and working style
- `USER.md` — info about you (Jake)
- `TOOLS.md` — local setup notes
- `BOOTSTRAP.md` — first-run ritual (AdamClaw will delete this after first conversation)
- `HEARTBEAT.md` — scheduled task config

Also create the shared `main` workspace (OpenClaw expects it):

```bash
mkdir -p ~/.openclaw/workspace
```

---

## Step 4 — Install the openclaw-logger plugin

From the repo root:

```bash
./install.sh
```

This builds the TypeScript plugin, copies it to `~/.openclaw/extensions/openclaw-logger/`, and verifies the config entry is correct.

---

## Step 5 — Start the Gateway

Start the OpenClaw Gateway container in Docker Desktop. On first run it will pull the image — give it a minute.

Verify it's running:

```bash
docker logs openclaw-openclaw-gateway-1 --tail 20
```

You should see:

- `[telegram] [default] starting provider (@AdamGenesisClaw_bot)`
- `[plugins] openclaw-logger: loaded without install/load-path provenance`
- `[gateway] listening on ws://...`

---

## Step 6 — Validate

Run the logger test to confirm the full stack is working end to end:

```bash
./test-logger.sh
```

All 10 checks should pass.

Then send a Telegram message to @AdamGenesisClaw_bot. Check the log to confirm it routed to `adamclaw`:

```bash
./view-logs.sh --tail 1
```

You should see `agent_id: adamclaw` and `channel: telegram`.

---

## Step 7 — Google API key (if using Gemini)

If OpenClaw doesn't already have your Google API key, configure it:

```bash
docker exec openclaw-openclaw-gateway-1 sh -c "openclaw config set ..."
```

Or use the OpenClaw web UI (browser at `http://localhost:18789`) to set up the Google provider auth. Your API key lives in your secure notes.

---

## What's NOT in the Repo

These you need to source elsewhere:

| Thing                   | Where to get it                                                                              |
| ----------------------- | -------------------------------------------------------------------------------------------- |
| Telegram bot token      | BotFather — the @AdamGenesisClaw_bot token                                                   |
| Google API key          | Google AI Studio (aistudio.google.com)                                                       |
| Gateway auth token      | Regenerated automatically by OpenClaw on first run                                           |
| AdamClaw's memory files | `~/.openclaw/agents/adamclaw/workspace/memory/` — these live on your Mac only, not backed up |

---

## Repo Structure Reference

```
Adam-Genesis-Claw/
├── agent-configs/
│   └── adamclaw/
│       └── workspace/       ← restore these to ~/.openclaw/agents/adamclaw/workspace/
│           ├── SOUL.md
│           ├── IDENTITY.md
│           ├── AGENTS.md
│           ├── USER.md
│           ├── TOOLS.md
│           ├── BOOTSTRAP.md
│           └── HEARTBEAT.md
├── openclaw-logger/         ← plugin source
├── install.sh               ← installs the logger plugin
├── test-logger.sh           ← validates the full stack
├── view-logs.sh             ← human-readable log viewer
└── Custom Resources/
    ├── Plugin Development Guide.md
    ├── openclaw-logger User Guide.md
    └── Agent Personalization Fields.md
```

---

## Keeping the Backup Current

Whenever you significantly change AdamClaw's workspace files (updating SOUL.md, AGENTS.md, etc.), sync them back to the repo:

```bash
cp ~/.openclaw/agents/adamclaw/workspace/*.md \
   /path/to/Adam-Genesis-Claw/agent-configs/adamclaw/workspace/

cd /path/to/Adam-Genesis-Claw
git add agent-configs/
FAST_COMMIT=1 git commit -m "chore: sync adamclaw workspace files"
git push
```

The `memory/` subdirectory inside the workspace is intentionally not backed up — it contains session-specific notes that are only meaningful in context. The personality files (SOUL, AGENTS, IDENTITY) are the important ones.
