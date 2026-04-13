# Trello Integration for Eve — Project Plan

**Status:** Complete (Phases 1–5 done) | Phase 6 moved to Backlog
**Goal:** Eve can create, assign, move, and comment on Trello cards from natural language in Telegram.

---

## Architecture

```
.env                          ← TRELLO_API_KEY, TRELLO_TOKEN (never committed)
docker-compose.yml            ← exposes env vars into container
skills/trello/trello.js       ← custom Node.js CLI baked into image
Dockerfile                    ← chmod + symlink to /usr/local/bin/trello
skills/trello/SKILL.md        ← documents all commands + standing rules for Eve
openclaw.json                 ← skills.entries.trello.enabled: true
                              ← eveclaw.skills: ["gog", "trello"]
~/.openclaw/agents/eveclaw/sessions/sessions.json  ← delete to force session rebuild
```

Credentials live in environment only — never in workspace files, never committed to git.

---

## Phases — All Complete

### Phase 1 — Credentials & Discovery ✓

- Trello Power-Up app created at https://trello.com/power-ups/admin (API flow changed — old app-key URL redirects here now)
- Token generated via authorize URL
- Board "Eve" created: https://trello.com/b/3oioeHwC/eve
- Lists created via API (Trello UI can't create lists on empty boards via old flow)
- Jake's member ID confirmed

**Resolved IDs:**

- **API Key:** `dcda80408f02e865e0c5d6420533209f`
- **Board:** Eve (`69dc3b64f75d0da7764082a9`)
- **Lists:** To Do `69dc3dc70b3ad81814230115` · In Progress `69dc3dc85f37660abbda047d` · Done `69dc3dc881f2374eb383eea2`
- **Jake's Member ID:** `652b2607bed36c61d4d2399b`

---

### Phase 2 — Build the `trello` CLI ✓

Node.js script at `skills/trello/trello.js`. Commands:

- `create-card <title> [--desc] [--list] [--assign] [--due]`
- `assign <cardId>`
- `set-due <cardId> <date>`
- `list-lists`
- `list-cards [--list <name>]`
- `get-card <cardId>`
- `move-card <cardId> <listName>`
- `archive-card <cardId>`
- `add-comment <cardId> <text>`

Note: `list-cards`, `move-card`, `archive-card`, and `add-comment` were added during Phase 5 testing — not in the original plan. See learnings section.

---

### Phase 3 — Bake into Docker ✓

- `skills/trello/trello.js` copied into image via existing `COPY skills ./skills`
- Dockerfile RUN block: `chmod +x /app/skills/trello/trello.js && ln -sf ... /usr/local/bin/trello`
- `.env`: `TRELLO_API_KEY`, `TRELLO_TOKEN`
- `docker-compose.yml`: env var passthrough

---

### Phase 4 — Skill Registration ✓

- `skills/trello/SKILL.md` written with Eve-specific commands, standing rules, natural language patterns
- `openclaw.json`: `skills.entries.trello.enabled: true`
- `eveclaw.skills: ["gog", "trello"]`
- Session reset: `rm ~/.openclaw/agents/eveclaw/sessions/sessions.json`

---

### Phase 5 — End-to-End Testing ✓

**Passed scenarios:**

1. "Create a Trello card: buy milk" → card created in To Do ✓
2. "Move all cards to Done" → list-cards + move-card loop worked ✓
3. `add-comment` added mid-testing after Eve tried to call a non-existent command

**Issues found and fixed during testing:**

- `list-cards`, `move-card`, `archive-card` were missing — Eve needed them for bulk operations
- `add-comment` was missing — Eve invented the command name and added `ask: "always"` (blocked on Telegram)
- Original bundled SKILL.md was generic curl-based — replaced with actual CLI docs

---

## Phase 6 — ClawhHub Packaging

Moved to Backlog. See `Custom Resources/Backlog.md`.

---

## Key Learnings

See `Custom Resources/Adding a New Skill (Docker Setup).md` for the full architectural patterns captured from this project.

Short version:

- SKILL.md must document the actual deployed binary, not a hypothetical API
- Think through ALL operations before writing the CLI (not just create — also list, move, archive, comment)
- Never include `ask: "always"` for routine write operations — document them as safe in SKILL.md
- Trello's `app-key` page changed; new flow is Power-Up Admin Portal
