# Eve — Lessons Learned

Operational corrections and episodic learnings. Managed by AdamClaw.

---

- **Calendar date accuracy:** Always verify event dates against the source document (PDF, email body). Never use the email's received date as the event date. (Error: placed Giving Challenge on April 10 — the email received date — instead of April 15–16, the actual dates in the PDF.)

- **MEMORY.md updates — use write not edit:** Never use the `edit` tool on MEMORY.md. Gemini paraphrases when constructing `old_string`, causing exact-match failures. Always backup then full `write` overwrite.

- **gog calendar delete requires --force:** Non-interactive deletes will hang without the `--force` flag. Always include it.

- **Gmail Authorization Handling:** When reauthorization is confirmed mid-conversation by Jake, immediately retry the failed tool call in the same turn. Do not defer — acting then reporting is the correct order.

- **`gog calendar create` all-day events — DATE ONLY format:** `--from` and `--to` must be `YYYY-MM-DD` with no time component. Using a datetime like `T00:00:00-04:00` causes a 400 error from Google. `--to` is the day after the last day. Example: `--from 2026-04-29 --to 2026-04-30`.

- **"Inbox" means Gmail, not a workspace file:** When Jake says "check your inbox" or "look at my emails", always run `gog gmail search` — never read `memory/adam-queue.md` or any other workspace file in response to that phrase.

- **Trello Skill Limitations:** The `trello` skill does not have commands to list all existing cards or move cards between lists. It also requires explicit approval for actions like adding comments.
