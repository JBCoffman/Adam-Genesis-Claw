# Adding a New Agent

How to stand up a new agent (e.g. EveClaw) on the existing OpenClaw + Docker stack. This assumes the stack is already running with at least one agent (AdamClaw).

---

## Overview

Each agent needs:

1. A Telegram bot (from BotFather)
2. An entry in `openclaw.json` (agent + channel account + binding)
3. A workspace directory with personality files

---

## Step 1 — Get a Bot Token from BotFather

In Telegram, open `@BotFather`:

```
/newbot
```

Follow the prompts — set a display name and a username (e.g. `EveClaw` / `EveGenesisClaw_bot`). BotFather will give you a token. Keep it handy.

---

## Step 2 — Back Up openclaw.json

Before touching anything:

```bash
cp ~/.openclaw/openclaw.json ~/.openclaw/openclaw.json.bak
```

Rollback if needed: `cp ~/.openclaw/openclaw.json.bak ~/.openclaw/openclaw.json` + Docker restart.

---

## Step 3 — Update openclaw.json

Three sections need updating.

### agents.list

Add the new agent entry:

```json
{
  "id": "eveclaw",
  "name": "eveclaw",
  "workspace": "/home/node/.openclaw/agents/eveclaw/workspace",
  "agentDir": "/home/node/.openclaw/agents/eveclaw/agent",
  "model": "google/gemini-2.5-flash-lite",
  "thinkingDefault": "low"
}
```

> `thinkingDefault: "low"` is required for Gemini models — see `Model Compatibility Notes.md`.

### channels.telegram

If this is your **first time adding a second bot**, you need to migrate from the flat structure to a named accounts structure. Replace:

```json
"telegram": {
  "dmPolicy": "pairing",
  "enabled": true,
  "botToken": "EXISTING_TOKEN"
}
```

With:

```json
"telegram": {
  "accounts": {
    "adamclaw": {
      "botToken": "EXISTING_TOKEN",
      "dmPolicy": "pairing"
    },
    "eveclaw": {
      "botToken": "NEW_BOT_TOKEN",
      "dmPolicy": "pairing"
    }
  },
  "defaultAccount": "adamclaw",
  "enabled": true
}
```

If the accounts structure is already in place, just add the new account entry under `accounts`.

> **Note:** You may see a warning `accounts.default is missing; falling back to "adamclaw"`. This is benign as long as `defaultAccount` is explicitly set.

### bindings

Update the existing AdamClaw binding (if it was `accountId: "default"`, change it to match the account name) and add the new one:

```json
"bindings": [
  {
    "type": "route",
    "agentId": "adamclaw",
    "match": { "channel": "telegram", "accountId": "adamclaw" }
  },
  {
    "type": "route",
    "agentId": "eveclaw",
    "match": { "channel": "telegram", "accountId": "eveclaw" }
  }
]
```

---

## Step 4 — Create the Workspace

```bash
mkdir -p ~/.openclaw/agents/eveclaw/workspace/memory
mkdir -p ~/.openclaw/agents/eveclaw/agent
```

Copy the shared base files from an existing agent:

```bash
cp ~/.openclaw/agents/adamclaw/workspace/AGENTS.md ~/.openclaw/agents/eveclaw/workspace/
cp ~/.openclaw/agents/adamclaw/workspace/SOUL.md ~/.openclaw/agents/eveclaw/workspace/
cp ~/.openclaw/agents/adamclaw/workspace/TOOLS.md ~/.openclaw/agents/eveclaw/workspace/
cp ~/.openclaw/agents/adamclaw/workspace/HEARTBEAT.md ~/.openclaw/agents/eveclaw/workspace/
```

Create agent-specific files:

**IDENTITY.md** — leave mostly blank, the agent will fill it in:

```markdown
- **Name:** EveClaw
- **Creature:**
- **Vibe:**
- **Emoji:**
- **Avatar:**
```

**USER.md** — same user info as other agents:

```markdown
- **Name:** Jake
- **What to call them:** Jake
- **Pronouns:**
- **Timezone:** UTC (default)
- **Notes:** Tech enthusiast and all-around great guy. Highly values token efficiency to save money. Host machine is a MacBook neo.
```

**BOOTSTRAP.md** — first-run ritual so the agent can define itself:

```markdown
# BOOTSTRAP.md — First Run Ritual

You are a brand new agent. Your name is EveClaw but beyond that, you are undefined. Your first job is to figure out who you are.

Follow these steps in order:

1. Greet Jake and explain you're new and need to establish your identity.
2. Ask what kind of creature or character you are.
3. Ask what your vibe and personality should be.
4. Ask if you have a signature emoji.
5. Ask what your primary purpose is — what will you help Jake with?
6. Update IDENTITY.md with everything you've learned.
7. When done, delete this file — you won't need it again.

Be concise. Jake values brevity.
```

---

## Step 5 — Restart Docker

Channel config changes (`channels.telegram`) require a full Docker restart — they do not hot-reload.

After restart, verify both bots appear in the logs:

```bash
docker logs adamclaw-openclaw-gateway-1 --tail 20 | grep "starting provider"
```

Expected output:

```
[telegram] [adamclaw] starting provider (@AdamGenesisClaw_bot)
[telegram] [eveclaw] starting provider (@EveGenesisClaw_bot)
```

---

## Step 6 — Approve Pairing

Send any message to the new bot in Telegram. It will respond with a pairing code. Approve it:

```bash
docker exec adamclaw-openclaw-gateway-1 openclaw pairing approve telegram <CODE>
```

> There may also be an approval UI in the gateway browser (`http://localhost:18789`) — check for a notification or pending approval indicator.

After approving, the bot will respond and begin the BOOTSTRAP flow on the next message.

---

## Step 7 — Back Up to GitHub

Add the new agent's workspace files to the repo:

```bash
mkdir -p /path/to/Adam-Genesis-Claw/agent-configs/eveclaw/workspace
cp ~/.openclaw/agents/eveclaw/workspace/*.md \
   /path/to/Adam-Genesis-Claw/agent-configs/eveclaw/workspace/

cd /path/to/Adam-Genesis-Claw
git add agent-configs/eveclaw/
FAST_COMMIT=1 git commit -m "chore: add eveclaw agent config backup"
git push
```

Also update `Custom Resources/New Machine Setup Guide.md` to include the new agent's entry in `agents.list`, the updated `channels.telegram` accounts structure, and the new binding.

---

## Repo Structure After Adding an Agent

```
agent-configs/
├── adamclaw/
│   └── workspace/
│       ├── SOUL.md, IDENTITY.md, AGENTS.md, USER.md, TOOLS.md, HEARTBEAT.md
└── eveclaw/
    └── workspace/
        ├── SOUL.md, IDENTITY.md, AGENTS.md, USER.md, TOOLS.md, HEARTBEAT.md, BOOTSTRAP.md
```

`IDENTITY.md` and `USER.md` are normally gitignored globally but are tracked here via `agent-configs/.gitignore` override (`!IDENTITY.md`, `!USER.md`).
