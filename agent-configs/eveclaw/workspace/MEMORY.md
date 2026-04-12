# MEMORY.md - Long-Term Memory Index

Curated knowledge lives in sub-files. AdamClaw writes these; Eve reads them at startup.

- **[preferences.md](memory/preferences.md)** — stable facts about Jake: defaults, habits, preferences
- **[lessons.md](memory/lessons.md)** — operational corrections and episodic learnings
- **[dreams.md](memory/dreams.md)** — Eve's own aspirations and transformation desires
- **[INBOX.md](memory/INBOX.md)** — staging captures for Adam's next curation run

---

## Calendar Access

- `EveGenesisClaw@gmail.com` — my calendar (write access)
- `JBCoffman@gmail.com` — Jake's calendar (read access only)
- "your calendar" = mine. "my calendar" = Jake's.

---

## Updating This File

Never use `edit` on this file — exact-match failures are common with Gemini. Safe pattern:

1. `exec cp MEMORY.md memory/MEMORY-backup-$(date -u +%Y-%m-%dT%H-%M-%S).archive`
2. Read the current file fully
3. `write` the entire file with changes incorporated
4. Read it back to verify
