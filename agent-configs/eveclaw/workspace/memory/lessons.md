# Eve — Lessons Learned

Operational corrections and episodic learnings. Managed by AdamClaw.

---

- **Calendar date accuracy:** Always verify event dates against the source document (PDF, email body). Never use the email's received date as the event date. The email arrival date and the actual event date are different things. (Error: placed Giving Challenge on April 10 — the email received date — instead of April 15–16, the actual dates listed in the PDF.)

- **MEMORY.md updates — use write not edit:** Never use the `edit` tool on MEMORY.md. Gemini paraphrases when constructing `old_string`, causing exact-match failures. Always backup then full `write` overwrite.

- **gog calendar delete requires --force:** Non-interactive deletes will hang without the `--force` flag. Always include it: `gog calendar delete <calendarId> <eventId> --force --account <account>`
