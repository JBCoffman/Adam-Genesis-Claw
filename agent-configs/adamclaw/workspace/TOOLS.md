# TOOLS.md - Operational Reference

Your cheat sheet for paths, schemas, and commands. Infrastructure knowledge lives here.

---

## Agent Anatomy

Every agent requires these workspace files:

| File           | Purpose                                                                                                       |
| -------------- | ------------------------------------------------------------------------------------------------------------- |
| `SOUL.md`      | Who the agent is — values, personality, continuity                                                            |
| `AGENTS.md`    | Operational instructions — startup, memory, role-specific workflows                                           |
| `TOOLS.md`     | Account-specific notes — paths, credentials, commands                                                         |
| `USER.md`      | Who they're helping — name, timezone, preferences                                                             |
| `IDENTITY.md`  | Name, creature, vibe, emoji                                                                                   |
| `HEARTBEAT.md` | Periodic check tasks (can be empty template)                                                                  |
| `BOOTSTRAP.md` | First-run birth certificate — only include if agent should negotiate identity on first run; deleted after use |

---

## Paths

### Repo (source of truth, committed to git)

```
agent-configs/{name}/workspace/          ← workspace files
agent-configs/_template/workspace/       ← starter templates for new agents
```

Host machine repo root: `/Users/home/tools/Adamclaw/`

### Live (what the agent actually reads at runtime)

```
Host:   ~/.openclaw/agents/{name}/workspace/
Docker: /home/node/.openclaw/agents/{name}/workspace/
```

### Sync pattern (repo → live)

```bash
cp -r agent-configs/{name}/workspace/. ~/.openclaw/agents/{name}/workspace/
```

Create the live directory first if it doesn't exist:

```bash
mkdir -p ~/.openclaw/agents/{name}/workspace/memory
```

### Session logs (JSONL transcripts)

```
~/.openclaw/agents/{name}/sessions/       ← contains *.jsonl files
```

Each JSONL file is one session. Sorted by modification time — newest is most recent.

### Adam's own workspace

```
Repo:  agent-configs/adamclaw/workspace/
Live:  ~/.openclaw/agents/adamclaw/workspace/
```

---

## openclaw.json — Agent Registration

File location: `~/.openclaw/openclaw.json`

Add to `agents.list[]`:

```json
{
  "id": "agentname",
  "name": "agentname",
  "workspace": "/home/node/.openclaw/agents/agentname/workspace",
  "agentDir": "/home/node/.openclaw/agents/agentname/agent",
  "model": "google/gemini-2.5-flash-lite",
  "thinkingDefault": "low",
  "skills": []
}
```

**Notes:**

- `id` and `name` are the same string, lowercase
- `workspace` and `agentDir` use the **Docker path** (`/home/node/...`), not the host path
- `skills` is an allowlist — empty means no skill SKILL.md files are injected
- Common skills: `gog` (Gmail/Calendar/Drive)
- `thinkingDefault`: `"low"` is standard; `"none"` saves tokens for simple agents

**Available model IDs:**

| Model                 | ID                             | Notes                                      |
| --------------------- | ------------------------------ | ------------------------------------------ |
| Gemini 2.5 Flash Lite | `google/gemini-2.5-flash-lite` | Default — fast, low cost                   |
| Gemini 2.5 Flash      | `google/gemini-2.5-flash`      | Mid-tier — faster thinking                 |
| Gemini 2.5 Pro        | `google/gemini-2.5-pro`        | Full Pro — highest capability, higher cost |

**After editing openclaw.json:** restart the gateway for changes to take effect.

```bash
# Restart via the OpenClaw Mac app, or:
scripts/restart-mac.sh
```

---

## Curation Heuristics

When processing session logs and daily notes:

| Signal                                              | Action                                           |
| --------------------------------------------------- | ------------------------------------------------ |
| Something happened once                             | Note in agent's daily file only — not long-term  |
| Same thing happened twice or more                   | Add to `memory/lessons.md`                       |
| Stable fact about Jake's preferences                | Add to `memory/preferences.md`                   |
| Operational correction (wrong flag, wrong behavior) | Add to `memory/lessons.md`                       |
| Agent expresses aspiration or growth desire         | Add to `memory/dreams.md` (create if needed)     |
| Entry already exists in memory                      | Skip — do not duplicate                          |
| Entry in memory is clearly outdated                 | Remove it, log the removal                       |
| Jake expresses same preference to multiple agents   | Note in Adam's own MEMORY.md cross-agent section |

**Lean is better than complete.** Memory files that grow unbounded stop being useful. When in doubt about whether to keep something, ask: would this change how the agent behaves in a future session? If no, skip it.

### Quality bar for entries

Each entry must clear all three:

1. **Actionable** — the agent can do something differently because of it
2. **Specific** — concrete enough to apply, not a vague generalization
3. **Non-obvious** — not something the agent would do by default anyway

Bad: "Jake values communication." Good: "Jake prefers one-line status updates over paragraphs when confirming completed tasks."

---

## Curation Paths Reference

Quick reference for each agent. Use these in your `read` and `exec` tool calls.

### EveClaw

```
Sessions:      ~/.openclaw/agents/eveclaw/sessions/*.jsonl
Workspace:     ~/.openclaw/agents/eveclaw/workspace/
preferences:   ~/.openclaw/agents/eveclaw/workspace/memory/preferences.md
lessons:       ~/.openclaw/agents/eveclaw/workspace/memory/lessons.md
dreams:        ~/.openclaw/agents/eveclaw/workspace/memory/dreams.md
INBOX:         ~/.openclaw/agents/eveclaw/workspace/memory/INBOX.md
daily notes:   ~/.openclaw/agents/eveclaw/workspace/memory/YYYY-MM-DD.md
```

### Poindexter

```
Sessions:      ~/.openclaw/agents/poindexter/sessions/*.jsonl
Workspace:     ~/.openclaw/agents/poindexter/workspace/
preferences:   ~/.openclaw/agents/poindexter/workspace/memory/preferences.md
lessons:       ~/.openclaw/agents/poindexter/workspace/memory/lessons.md
dreams:        ~/.openclaw/agents/poindexter/workspace/memory/dreams.md  ← create when signal found
INBOX:         ~/.openclaw/agents/poindexter/workspace/memory/INBOX.md
daily notes:   ~/.openclaw/agents/poindexter/workspace/memory/YYYY-MM-DD.md
```

### Session log reading pattern

```bash
# List sessions newest first
exec ls -lt ~/.openclaw/agents/{name}/sessions/*.jsonl

# Sessions are JSONL — each line is a JSON object with type, timestamp, message fields
# Read the full file — don't skim
# Look for role: "user" messages (Jake's input) and role: "assistant" messages (agent responses)
```

---

## Adam's Audit Log

File: `memory/adam-updates.log`

Append one entry per curation run:

```
[2026-04-12] eveclaw — Added to preferences.md: default event time 8:30 AM. Added to lessons.md: calendar date accuracy (use source date, not email received date). INBOX.md archived (2 entries).
```

Format: `[YYYY-MM-DD] {agent} — {summary of changes}`

---

## Agents on Adam's Roster

Knowledge files live at `agents/{NAME}.md` in this workspace.

Current roster:

- `agents/EVE.md` — EveClaw, Jake's primary daily assistant
- `agents/POINDEXTER.md` — Poindexter, data correlation engine and decision support

---

## Agent Template Location

When creating a new agent, use `agent-configs/_template/workspace/` as the starting point. Customize each file for the agent's specific purpose.
