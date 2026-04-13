# Trello Integration for Eve — Project Plan

**Status:** In progress — Phase 1 (credentials)
**Goal:** Eve can create and assign Trello cards to Jake from natural language in Telegram.

---

## Architecture

```
.env                          ← TRELLO_API_KEY, TRELLO_TOKEN (never committed)
docker-compose.yml            ← exposes env vars into container
Dockerfile                    ← installs /usr/local/bin/trello at build time
skills/trello/SKILL.md        ← documents commands for Eve
openclaw.json                 ← skills.entries.trello.enabled: true
                              ← eveclaw.skills: ["gog", "trello"]
~/.openclaw/agents/eveclaw/sessions/sessions.json  ← delete after skill add to force rebuild
```

Credentials live in environment only — never in workspace files, never committed to git.

---

## Phases

### Phase 1 — Credentials & Discovery ← CURRENT

**Jake does:**

1. Go to https://trello.com/app-key → copy the API Key
2. On that same page, click the "Token" link to generate a token
   - Use this URL (substitute your key): `https://trello.com/1/authorize?expiration=never&scope=read,write&response_type=token&name=EveClaw&key=YOUR_API_KEY`
   - Authorize → copy the token
3. Have both ready to hand to Claude

**Claude does:**

- Test connection with a curl call to list boards
- Identify: board ID(s), list ID(s), Jake's Trello member ID
- Document all IDs in this file under "Resolved IDs" section below

**Milestone:** Single curl command creates a card and assigns it to Jake. Visible in Trello.

---

### Phase 2 — Build the `trello` CLI

Write a Node.js script with these commands:

- `trello create-card "title" "description" [--list <listId>]`
- `trello assign <cardId> <memberId>`
- `trello set-due <cardId> <date>`
- `trello list-lists`

Script reads `$TRELLO_API_KEY` and `$TRELLO_TOKEN` from environment.
Tested standalone from the host before touching Docker.

**Milestone:** Each command works from the terminal. Create + assign + due date all confirmed.

---

### Phase 3 — Bake into Docker

1. Add `trello` script to repo (no credentials — reads from env)
2. Add `RUN` block to Dockerfile installing it at `/usr/local/bin/trello`
3. Add to `.env`: `TRELLO_API_KEY=...` and `TRELLO_TOKEN=...`
4. Add to `docker-compose.yml` environment section
5. Rebuild image: `docker compose down && docker build -t openclaw:local . && docker compose up -d`
6. Verify: `docker exec adamclaw-openclaw-gateway-1 which trello`

**Milestone:** `trello create-card "test"` works from inside the container.

---

### Phase 4 — Skill Registration

1. Write `skills/trello/SKILL.md` documenting all commands
2. Enable in `openclaw.json`: `skills.entries.trello.enabled: true`
3. Add `"trello"` to Eve's `skills[]` in `openclaw.json`
4. Reset Eve's session: `rm ~/.openclaw/agents/eveclaw/sessions/sessions.json`
5. Verify: check new `sessions.json` contains `trello` in `skillsSnapshot.skills`

**Milestone:** SKILL.md is clean enough to use cold. Session confirmed rebuilt with trello skill.

---

### Phase 5 — End-to-End Test

Test sequence (each must pass before calling it done):

1. "Create a Trello card: buy milk" → card appears, unassigned
2. "Create a Trello card: buy milk, assign to me" → card appears, assigned to Jake
3. "Trello card: fix the deck light, due Friday" → card with due date
4. Ambiguous list → Eve asks which list before creating

**Milestone:** All four variants working. Jake signs off.

---

### Phase 6 — Polish & ClawhHub (post-validation)

- Error handling: token expiry, API failures, network errors
- Multi-board support: Eve resolves board names → IDs
- Label support
- Package as proper OpenClaw plugin + publish to ClawhHub

---

## Resolved IDs

_(filled in during Phase 1)_

- **API Key:** `(pending)`
- **Token:** `(pending)`
- **Board ID:** `(pending)`
- **Default List ID:** `(pending)`
- **Jake's Member ID:** `(pending)`

---

## Notes & Decisions

- Script language: Node.js (more robust error handling than shell for API calls)
- Credentials pattern: follows `GOG_KEYRING_PASSWORD` precedent in this stack
- Binary location: `/usr/local/bin/trello` baked into Dockerfile (same as gog pattern)
- Session reset required after adding skill to Eve's allowlist (skills injected at session creation time)
