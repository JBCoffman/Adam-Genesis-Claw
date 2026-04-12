# EVE.md — EveClaw Knowledge File

Agent: EveClaw
Role: Jake's primary daily assistant — email triage, calendar management, daily tasks
Channel: Telegram (`eveclaw` bot)
Model: `google/gemini-2.5-flash-lite`
Skills: `gog` (Gmail, Calendar, Drive)

---

## File Structure

### Workspace (live)

```
~/.openclaw/agents/eveclaw/workspace/
├── SOUL.md          ← her identity and values
├── AGENTS.md        ← operational instructions, startup sequence, memory rules
├── TOOLS.md         ← gog commands, PDF workflow, calendar event rules
├── USER.md          ← Jake's details (timezone, preferences)
├── IDENTITY.md      ← name, vibe, emoji
├── HEARTBEAT.md     ← periodic check tasks
├── MEMORY.md        ← lean index pointing to memory sub-files
└── memory/
    ├── preferences.md    ← stable Jake preferences (Adam writes)
    ├── lessons.md        ← episodic learnings and corrections (Adam writes)
    ├── INBOX.md          ← staging file: Eve appends mid-session; Jake writes journal entries; Adam processes
    └── YYYY-MM-DD.md     ← daily session notes (Eve writes)
```

### Repo (source of truth)

```
agent-configs/eveclaw/workspace/   ← same layout, committed to git
```

### Session logs (JSONL transcripts)

```
~/.openclaw/agents/eveclaw/sessions/    ← *.jsonl files, one per session
```

---

## What Adam Curates

### Reads (per curation run)

1. JSONL session logs since last run — full conversation transcripts
2. `memory/YYYY-MM-DD.md` files — Eve's daily notes (last 7 days minimum)
3. `memory/INBOX.md` — staged captures from Eve mid-session and Jake's journal entries

### Writes

| Source signal                   | Target file             |
| ------------------------------- | ----------------------- |
| Stable Jake preference          | `memory/preferences.md` |
| Lesson / operational correction | `memory/lessons.md`     |
| MEMORY.md index needs update    | `MEMORY.md`             |

Adam does **not** write to Eve's daily notes or INBOX.md (except to archive processed INBOX entries).

### Does not touch

- `SOUL.md`, `AGENTS.md`, `TOOLS.md`, `USER.md` — these are managed by Jake and AdamClaw together, not auto-curated
- Active session context — Adam only reads completed sessions

---

## Memory File Formats

### preferences.md

```markdown
# Eve — Jake's Preferences

- **Default event time:** 8:30 AM start, 1 hour duration when no time is specified
- **Token efficiency:** Jake highly values keeping API costs low; prefer concise responses
- ...
```

### lessons.md

```markdown
# Eve — Lessons Learned

- **Calendar date accuracy:** Always verify event dates against the source document (PDF, email body). Never use the email's received date as the event date. (Error: placed Giving Challenge on April 10 — email arrival date — instead of April 15-16 from the PDF.)
- ...
```

### INBOX.md

Unstructured. Eve appends items with a timestamp prefix; Jake writes free-form.
Adam processes all entries and then clears or archives the file.

```markdown
# INBOX

[2026-04-12 Eve] Jake mentioned he prefers morning events before 10 AM when possible.

[Jake] The kids' school is called Westfield Elementary. Remember this for event titles.
```

---

## Known Behavioral Notes

- Eve runs on Gemini 2.5 Flash Lite which paraphrases when building `old_string` for `edit` calls — exact-match failures are common. She should always use `write` (full overwrite with prior backup) for MEMORY.md updates.
- Eve's sessions can run long (40k+ tokens with calendar batch tasks). Watch for `stopReason: "error"` context-limit failures in logs — these are signals that a session had incomplete work that may need recovery.
- Eve's backup command uses `.archive` extension: `MEMORY-backup-YYYY-MM-DDTHH-MM-SS.archive`

---

## Curation Schedule

Weekly (Sunday night or Monday morning). On-demand when Jake or Eve requests it.

After each run, append to `memory/adam-updates.log` in Adam's own workspace.
