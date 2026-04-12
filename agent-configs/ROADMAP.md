# Agent Architecture Roadmap

AdamClaw + EveClaw build-out plan. Work in phases, test and commit at each checkpoint.

---

## Context

**EveClaw** — Jake's primary assistant. Handles email, calendar, daily tasks via Telegram.
Runs on `google/gemini-2.5-flash-lite`. Skills: `gog` (Gmail, Calendar, Drive).

**AdamClaw** — Agent infrastructure specialist. Two pillars:

1. **Memory Curator** — reads agent session logs, extracts what matters, writes to long-term memory files. Keeps agents contextually sharp across sessions.
2. **Creation Agent** — when Jake wants a new agent, Adam builds them: workspace files, identity, config registration, live sync. Knows the full agent anatomy.

---

## Agent Anatomy

Every agent needs these workspace files:

| File           | Purpose                                               |
| -------------- | ----------------------------------------------------- |
| `SOUL.md`      | Who the agent is — values, personality, continuity    |
| `AGENTS.md`    | Operational instructions — startup, memory, workflows |
| `TOOLS.md`     | Account-specific notes — paths, credentials, commands |
| `USER.md`      | Who they're helping — name, timezone, preferences     |
| `IDENTITY.md`  | Name, creature, vibe, emoji                           |
| `HEARTBEAT.md` | Periodic check tasks                                  |
| `BOOTSTRAP.md` | First-run birth certificate (deleted after use)       |

**Repo path:** `agent-configs/{name}/workspace/`
**Live path (host):** `~/.openclaw/agents/{name}/workspace/`
**Live path (Docker):** `/home/node/.openclaw/agents/{name}/workspace/`

**Registration** in `~/.openclaw/openclaw.json` under `agents.list[]`:

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

---

## Phase 1 — Adam's Dual Identity

**Goal:** Adam knows who he is and what he does — both pillars.

**Files to write/update (repo + live):**

- `agent-configs/adamclaw/workspace/SOUL.md` — rewrite around Curator + Creator roles
- `agent-configs/adamclaw/workspace/AGENTS.md` — startup for his role; curation mode + creation mode workflow sections
- `agent-configs/adamclaw/workspace/TOOLS.md` — agent anatomy, repo/live paths, `openclaw.json` schema, sync pattern
- `agent-configs/adamclaw/workspace/agents/EVE.md` _(new)_ — first entry in his per-agent knowledge base: who Eve is, her full file structure, her JSONL log paths, what Adam curates

**Sync:** Copy all to `~/.openclaw/agents/adamclaw/workspace/`

**Test checkpoint:** Start Adam session. Ask:

1. "What do you do?" — should describe both pillars unprompted
2. "If Jake asked you to create a new agent, what would you do?" — should walk through the creation steps

**Commit:** `adamclaw: define dual purpose — memory curator and creation agent`

---

## Phase 2 — Eve's Structured Memory

**Goal:** Eve has structured memory files that Adam can write to.

**Files to create (repo + live):**

- `memory/preferences.md` — stable Jake prefs. Seed with: 8:30 AM default event time, 1hr duration; values token efficiency; enjoys porch time
- `memory/lessons.md` — episodic learnings. Seed with: calendar date error (used email received date instead of event date from PDF)
- `memory/INBOX.md` — staging capture. Empty but documented. Eve appends mid-session; Jake can write free-form entries; Adam processes both

**Files to update (repo + live):**

- `MEMORY.md` — rewrite as lean index pointing to sub-files
- `AGENTS.md` — startup reads sub-files + **auto-backup MEMORY.md at session start** (not at write time — fixes the "skips backup" problem)
- `HEARTBEAT.md` — add INBOX.md check task

**Test checkpoint:** Start Eve session:

1. Confirm she reads preferences.md and lessons.md at startup
2. Confirm heartbeat prompt checks INBOX.md
3. Confirm auto-backup fires at session start (backup file appears in `memory/`)

**Commit:** `eveclaw: structured memory — preferences, lessons, INBOX, auto-backup`

---

## Phase 3 — Adam's Curation Workflow

**Goal:** Adam knows exactly how to read Eve's state and write her memory. Generic — works for any agent.

**Files to update:**

- `agent-configs/adamclaw/workspace/agents/EVE.md` — expand with: exact JSONL log paths, what to read per run, what to write where, deduplication rules
- `agent-configs/adamclaw/workspace/AGENTS.md` — add full curation workflow:
  1. Read target agent's JSONL logs since last run
  2. Read recent daily notes
  3. Read INBOX.md
  4. Read current memory files (for deduplication)
  5. Extract what's new and worth keeping
  6. Write to appropriate files (preferences.md, lessons.md, MEMORY.md index)
  7. Archive processed INBOX entries
  8. Append to `memory/adam-updates.log`

**Heuristics for "worth keeping":**

- Once = note in daily file
- Twice = lesson in lessons.md
- Stable preference about Jake = always keep in preferences.md
- Operational correction (wrong flag, wrong behavior) = always keep in lessons.md

**Files to create:**

- `agent-configs/adamclaw/workspace/memory/adam-updates.log` — audit trail: what changed, when, for which agent

**Test checkpoint:** Give Adam a sample session log excerpt (fabricated). Ask for a dry-run curation pass. Verify:

- Correct file targets identified
- No duplication with existing entries
- Correct log entry format

**Commit:** `adamclaw: curation workflow and Eve knowledge file`

---

## Phase 4 — Weekly Cron + On-Demand Trigger

**Goal:** Adam runs on his own, once a week.

**What to build:**

- OpenClaw cron config for Adam — Sunday night or Monday morning
- Cron prompt that fires his curation workflow for all agents he manages
- On-demand: documented so Jake or Eve can trigger Adam immediately with "review my recent sessions"
- Add note in Eve's `AGENTS.md`: "You can ask Adam to review your recent sessions at any time"

**Test checkpoint:** Trigger a manual run:

1. Adam reads Eve's JSONL logs and INBOX.md
2. Writes at least one update to preferences.md or lessons.md
3. Logs the change to adam-updates.log
4. Re-run immediately — confirms no duplicates

**Commit:** `adamclaw: weekly curation cron`

---

## Phase 5 — Creation Workflow End-to-End

**Goal:** Adam can spin up a new agent from scratch without Jake having to manually edit files.

**What to build:**

- Creation workflow in Adam's `AGENTS.md`: receive `name` + `purpose` → write all workspace files → sync repo → sync live → update `openclaw.json` → create `agents/{NAME}.md` in his own knowledge base → report back to Jake
- Starter template files at `agent-configs/_template/workspace/` — Adam uses these as scaffolding, customizes per agent
- Adam writes back to Jake with: what was created, what Jake needs to do (channel setup, any manual steps)

**Test checkpoint:** Ask Adam: "Create a new agent named TestClaw, purpose: testing things."

1. Verify repo files created at `agent-configs/testclaw/workspace/`
2. Verify live workspace synced to `~/.openclaw/agents/testclaw/workspace/`
3. Verify `openclaw.json` updated with TestClaw registration
4. Verify `agents/TESTCLAW.md` created in Adam's knowledge base
5. Start a TestClaw session to verify it comes up correctly

**Cleanup:** Delete TestClaw after test passes (Adam should be able to do this too).

**Commit:** `adamclaw: agent creation workflow`

---

## Phase 6 — Polish & Cleanup

- Remove `BOOTSTRAP.md` from Adam's repo config (he's past it)
- Fix Adam's live `USER.md` timezone (currently UTC, should be America/New_York)
- Any behavioral gaps found during testing phases 1–5
- Verify full loop: new agent (Adam-created) → memory structure in place → Adam curates it

**Commit:** `eveclaw/adamclaw: polish and cleanup`

---

## Dependency Order

```
Phase 1 ──┐
           ├──> Phase 3 ──> Phase 4
Phase 2 ──┘

Phase 1 ──> Phase 5 (creation needs Adam's identity complete)

Phase 6 (cleanup, runs last)
```

Phases 1 and 2 are fully independent — can be parallelized.
Phase 5 depends only on Phase 1.
Phase 3 depends on both 1 and 2.
Phase 4 depends on Phase 3.

---

## Future Projects (Backlog)

### Dynamic model selection for Adam

Currently Adam's model is hardcoded in `openclaw.json`. For agent creation tasks, he benefits from running on a more capable model (Gemini Pro); for curation and routine work, Flash Lite is sufficient.

**Desired behavior:** Adam selects his own model tier based on task complexity — Pro for creation/architecture work, Flash Lite for routine curation runs.

**Current state:** Manually toggled. Adam is temporarily set to `google/gemini-2.5-pro` for the initial agent creation task; will be reset to `google/gemini-2.5-flash-lite` afterward.

**Implementation ideas:** Per-cron model override in OpenClaw config; or a self-directed model-swap skill; or a task-type header Adam includes that the gateway uses for routing.
