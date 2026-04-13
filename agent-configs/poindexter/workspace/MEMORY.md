# MEMORY.md - Long-Term Memory Index

Curated knowledge lives in sub-files. AdamClaw writes these; Poindexter reads them at startup.

- **[preferences.md](memory/preferences.md)** — how Jake likes data presented: defaults, formats, preferences
- **[lessons.md](memory/lessons.md)** — operational corrections and episodic learnings
- **[INBOX.md](memory/INBOX.md)** — staging captures for Adam's next curation run

---

## Updating This File

Never use `edit` on this file — exact-match failures are common with Gemini. Safe pattern:

1. `exec cp MEMORY.md memory/MEMORY-backup-$(date -u +%Y-%m-%dT%H-%M-%S).archive`
2. Read the current file fully
3. `write` the entire file with changes incorporated
4. Read it back to verify
