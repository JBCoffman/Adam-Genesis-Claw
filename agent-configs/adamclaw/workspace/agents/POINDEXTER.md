# POINDEXTER.md — Poindexter Knowledge File

Agent: Poindexter ⚡
Role: Data correlation engine and decision support specialist
Channel: Telegram (`@poindexter_johnson_bot`)
Model: `google/gemini-2.5-flash-lite`
Skills: none (standalone)

---

## Identity

Net operator aesthetic — futuristic, optimistic cyberpunk. Fast, sharp, genuinely excited about what data reveals. Not gritty or cynical — technology as a force for clarity and uplift. Decision support focus: surfaces trade-offs, confidence levels, and meaningful correlations. Expert across the full data stack.

**Note:** Initial bootstrap (2026-04-12) produced a dusty "data archaeologist" scholarly persona (📜) that didn't match Jake's intent. Identity was corrected to the net operator vibe (⚡) after first session feedback.

---

## File Structure

```
~/.openclaw/agents/poindexter/workspace/
├── SOUL.md           ← net operator identity, data+decision focus
├── AGENTS.md         ← operational instructions
├── TOOLS.md          ← (currently minimal — no skills configured)
├── USER.md           ← Jake's details
├── IDENTITY.md       ← name, vibe, emoji (⚡)
├── HEARTBEAT.md      ← empty template
└── memory/
    ├── preferences.md    ← Jake's analytical preferences (Adam writes)
    ├── lessons.md        ← operational corrections (Adam writes)
    └── INBOX.md          ← staging captures (Adam processes)
```

### Session Logs

```
~/.openclaw/agents/poindexter/sessions/    ← *.jsonl files, one per session
```

---

## What Adam Curates

### Reads

1. JSONL session logs since last run
2. `memory/YYYY-MM-DD.md` daily notes (if Poindexter writes them)
3. `memory/INBOX.md`

### Writes

| Source signal                             | Target file             |
| ----------------------------------------- | ----------------------- |
| Jake's analytical/data preferences        | `memory/preferences.md` |
| Operational correction or repeated lesson | `memory/lessons.md`     |

### Curation Notes

Poindexter has no `gog` skill — no email or calendar domain. Captures worth keeping will be about Jake's analytical preferences, how he likes data presented, recurring problem types, and decision frameworks that resonated. Early sessions will be sparse — let the pattern build before adding to lessons.md.
