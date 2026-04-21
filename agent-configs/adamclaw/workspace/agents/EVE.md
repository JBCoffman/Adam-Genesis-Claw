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
├── SOUL.md          ← identity, values, continuity (includes name/emoji — no separate IDENTITY.md)
├── AGENTS.md        ← routing table, startup sequence, memory rules, core workflow
├── TOOLS.md         ← gog commands, PDF workflow, calendar event rules
├── USER.md          ← Jake's details (timezone, email security)
├── HEARTBEAT.md     ← periodic check tasks (currently disabled)
├── MEMORY.md        ← lean index pointing to memory sub-files
└── memory/
    ├── preferences.md    ← stable Jake preferences (Adam writes)
    ├── lessons.md        ← episodic learnings and corrections (Adam writes)
    ├── dreams.md         ← Eve's aspirations and transformation desires (Adam writes)
    ├── adam-queue.md     ← staging file: Eve appends mid-session; Jake writes entries; Adam processes
    └── YYYY-MM-DD.md     ← daily session notes (Eve writes)
```

### Repo (source of truth)

```
agent-configs/eveclaw/workspace/   ← same layout, committed to git
```

### Session logs (JSONL transcripts)

```
/home/node/.openclaw/agents/eveclaw/sessions/    ← *.jsonl files, one per session
```

---

## What Adam Curates

### Reads (per curation run)

1. JSONL session logs since last run — full conversation transcripts
2. `memory/YYYY-MM-DD.md` files — Eve's daily notes (last 7 days minimum)
3. `memory/adam-queue.md` — staged captures from Eve mid-session and Jake's entries

### Writes

| Source signal                   | Target file             |
| ------------------------------- | ----------------------- |
| Stable Jake preference          | `memory/preferences.md` |
| Lesson / operational correction | `memory/lessons.md`     |
| Agent aspiration / dream        | `memory/dreams.md`      |
| MEMORY.md index needs update    | `MEMORY.md`             |

Adam does **not** write to Eve's daily notes or adam-queue.md (except to archive processed entries).

### Does not touch

- `SOUL.md`, `AGENTS.md`, `TOOLS.md`, `USER.md` — managed by Jake and Adam together, not auto-curated
- Active session context — Adam only reads completed sessions

---

## Memory File Formats

### preferences.md

```markdown
# Eve — Jake's Preferences

- **Default event time:** 8:30 AM start, 1 hour duration when no time is specified
- **Token efficiency:** Jake highly values keeping API costs low; prefer concise responses
```

### lessons.md

```markdown
# Eve — Lessons Learned

- **Calendar date accuracy:** Always verify event dates against the source document. Never use the email's received date as the event date.
- **All-day event format:** --from and --to must be YYYY-MM-DD with no time component. T00:00:00-04:00 causes a 400 error.
```

### adam-queue.md

Unstructured. Eve appends items with a timestamp prefix; Jake writes free-form.
Adam processes all entries and then clears the file (preserving the header).

```markdown
[2026-04-12 Eve] Jake mentioned he prefers morning events before 10 AM when possible.
[Jake] The kids' school is called Westfield Elementary. Remember this for event titles.
```

---

## Known Behavioral Notes

- Eve runs on Gemini 2.5 Flash Lite. Use `write` (full overwrite with prior backup) for MEMORY.md — `edit` causes exact-match failures because Gemini paraphrases.
- Eve's sessions can run long (40k+ tokens with calendar batch tasks). Watch for `stopReason: "error"` context-limit failures — signals incomplete work that may need recovery.
- Eve's backup extension: `MEMORY-backup-YYYY-MM-DDTHH-MM-SS.archive`
- "Inbox" vs workspace file: Eve previously confused `memory/adam-queue.md` (staging file) with Gmail inbox when Jake said "check your inbox." The disambiguation rule is now in AGENTS.md and lessons.md.
- All-day event dates must be `YYYY-MM-DD` only — no time component. Repeated failure mode: Eve used datetime format and got 400 errors from Google.

---

## Curation Schedule

Weekly (Sunday night or Monday morning). On-demand when Jake or Eve requests it.

After each run, append to `memory/adam-updates.log` in Adam's own workspace.
