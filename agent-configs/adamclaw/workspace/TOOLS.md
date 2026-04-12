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

| Signal                                              | Action                                          |
| --------------------------------------------------- | ----------------------------------------------- |
| Something happened once                             | Note in agent's daily file only — not long-term |
| Same thing happened twice or more                   | Add to `memory/lessons.md`                      |
| Stable fact about Jake's preferences                | Add to `memory/preferences.md`                  |
| Operational correction (wrong flag, wrong behavior) | Add to `memory/lessons.md`                      |
| Entry already exists in memory                      | Skip — do not duplicate                         |
| Entry in memory is clearly outdated                 | Remove it, log the removal                      |

**Lean is better than complete.** Memory files that grow unbounded stop being useful. When in doubt about whether to keep something, ask: would this change how the agent behaves in a future session? If no, skip it.

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
