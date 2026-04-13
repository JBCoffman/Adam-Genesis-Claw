# Adding a New Skill (Docker Setup)

How to enable a new OpenClaw skill in this Docker-based setup. Written to be complete enough for a coding agent to execute without follow-up questions.

---

## How Skills Work in This Setup

A skill becomes usable when **all three** of these are true:

1. **Binary is present** — the skill's CLI tool exists at `/usr/local/bin/<tool>` inside the container
2. **Skill is enabled** at the gateway level (`skills.entries.<id>.enabled: true` in `openclaw.json`)
3. **Per-agent allowlist** permits it — by default all agents have full access; disabling a skill for a specific agent creates a per-agent denylist

The web UI Skills tab (per-agent) controls #3 only. #1 and #2 must be set up separately.

**Two types of skills:**

- **Binary-only** — just needs the CLI tool installed; no auth setup (e.g. `goplaces`, `weather`)
- **Auth-required** — needs OAuth or API key setup after binary install (e.g. `gog`, `1password`)

---

## Current Infrastructure State (as of April 2026)

Things already in place — do not redo these:

- **XDG persistence:** `XDG_CONFIG_HOME=/home/node/.openclaw/.config` and `XDG_DATA_HOME=/home/node/.openclaw/.local/share` are set in `docker-compose.yml`. Any XDG-compliant skill CLI automatically stores config in the volume-mounted directory and survives container rebuilds.
- **`GOG_KEYRING_PASSWORD`** is set in `.env` and wired into `docker-compose.yml`. Used by gog's file-based keyring.
- **Docker image:** `openclaw:local`, built locally from `Dockerfile`. The compose file uses a pre-built image — `docker compose build` does nothing; use `docker build -t openclaw:local .` explicitly.
- **Running container:** `adamclaw-openclaw-gateway-1`. The old `openclaw-openclaw-gateway-1` container (from a renamed directory) is stopped and should remain stopped.
- **Rebuild/restart pattern:**
  ```bash
  cd /Users/home/tools/Adamclaw
  docker compose down && docker build -t openclaw:local . && docker compose up -d
  ```

---

## Step 1 — Check the Skill's Requirements

```bash
docker exec adamclaw-openclaw-gateway-1 openclaw skills info <skill-id>
```

This shows:

- Whether the binary is present (`✓`) or missing
- The binary name(s) required
- The skill's source (bundled) and SKILL.md path

Also check the SKILL.md for auth requirements:

```bash
docker exec adamclaw-openclaw-gateway-1 cat /app/skills/<skill-id>/SKILL.md
```

---

## Skill Types

**Type A — Pre-built binary skill:** Download and install a released binary (e.g. `gog`, weather tools). Follow Steps 2–6 below.

**Type B — Custom Node.js skill:** Write a Node.js CLI script and bake it into the image. Skip the binary download — instead place the script in `skills/<id>/<id>.js` and add a Dockerfile symlink step. See "Custom Node.js Skills" section below before Step 2.

---

## Custom Node.js Skills

When a skill doesn't exist as an installable binary — or you need behavior the binary doesn't provide — write a custom Node.js CLI that lives in the repo.

### Pattern

1. Create `skills/<skill-id>/<skill-id>.js` (executable Node.js script with `#!/usr/bin/env node`)
2. Add credentials to `.env` and wire through `docker-compose.yml` environment (same as `GOG_KEYRING_PASSWORD` pattern)
3. In `Dockerfile`, after the `COPY --from=runtime-assets ... /app/skills ./skills` line, add:

```dockerfile
# Install <skill-name> CLI
RUN chmod +x /app/skills/<skill-id>/<skill-id>.js && \
    ln -sf /app/skills/<skill-id>/<skill-id>.js /usr/local/bin/<skill-id>
```

4. Register in `openclaw.json` (the skill may already exist in `skills.entries` as `enabled: false` — check before adding)
5. Write SKILL.md — see "Writing Effective SKILL.md Files" below

### Key constraint

`skills/` is baked into the Docker image at build time — it is **not volume-mounted**. Any change to the CLI script or SKILL.md requires a full image rebuild:

```bash
docker compose down && docker build -t openclaw:local . && docker compose up -d
```

### Testing before Docker

Test the Node.js script locally before rebuilding:

```bash
TRELLO_API_KEY=<key> TRELLO_TOKEN=<token> node skills/<skill-id>/<skill-id>.js <command>
```

All commands should work locally. Only rebuild Docker once local tests pass.

---

## Writing Effective SKILL.md Files

The SKILL.md is injected into the agent's system prompt when the skill is active. A poor SKILL.md causes the agent to hallucinate command names, use wrong syntax, or add unnecessary approval gates. Follow these principles:

### Document the actual binary, not the API

The SKILL.md must describe the CLI that is actually deployed in the container. Do not document `curl` commands or raw API endpoints if there is a binary available — the agent will try to use whatever you document.

### Think through all operations before writing the CLI

Before writing the CLI, list every operation the agent might need — not just the happy path. Common gaps found during testing:

- Created cards but had no way to **list** them (needed to bulk-move by name)
- Created cards but had no way to **move** them between lists
- Moved cards but had no way to **comment** on the action taken

For any entity-management skill, the complete CRUD set is usually: `create`, `list`, `get`, `update/move`, `archive/delete`, plus `add-comment` if the service supports it.

### Mark routine write operations as safe

If an operation is write-but-safe (posting a comment, adding a label), say so explicitly in SKILL.md:

```markdown
This is a routine, safe operation — no special approval needed. Call it after every action.
```

Without this, the agent may add `ask: "always"` to the `exec` call, which blocks completely on Telegram (no approval UI). Only destructive or irreversible operations warrant approval gates.

### Add standing behavioral rules

Use a "Standing Rules" section for patterns the agent should always follow — not just what commands exist but when and how to chain them:

```markdown
## Standing Rules

**Always comment on every action.** After any move-card, archive-card, assign, or set-due call,
immediately follow with `trello add-comment <cardId> "<action taken>"`.
```

### Include natural language → command mapping

Agents reason about intent first, then look for matching commands. Explicit mappings reduce reasoning steps and hallucination:

```markdown
- "Move all cards to Done" → `trello list-cards`, then `trello move-card <id> Done` for each
- "Archive the buy milk card" → `trello list-cards`, find ID, `trello archive-card <id>`
```

### Check if the skill already exists in the registry

Before creating a skill from scratch, check `openclaw.json`:

```bash
python3 -c "import json; d=json.load(open('/Users/home/.openclaw/openclaw.json')); print([k for k in d['skills']['entries']])" | tr ',' '\n'
```

Many skills are pre-registered as `enabled: false`. If the skill ID exists, only the binary and SKILL.md are needed — the registry entry is already there.

---

## Step 2 — Add the Binary to the Dockerfile

Binaries **must be baked into the image** at build time. Installing inside a running container is lost on restart.

Open `Dockerfile` and add a `RUN` block in the runtime stage, after the existing gog install line (around line 151). Use architecture detection — this Mac runs Apple Silicon (ARM64) but the pattern should handle both:

```dockerfile
# Install <toolname> for <skill description>
RUN ARCH=$(uname -m | sed 's/x86_64/amd64/;s/aarch64/arm64/') && \
    curl -fsSL "https://github.com/<owner>/<repo>/releases/download/v<version>/<binary>_<version>_linux_${ARCH}.tar.gz" \
    | tar -xz -C /usr/local/bin && chmod +x /usr/local/bin/<binary>
```

**Finding the correct URL:**

- Check the brew formula in `steipete/homebrew-tap` for the exact repo name and filename pattern — the formula always has the right URL
- The repo name in the formula may differ from the binary name (e.g. `gogcli` repo → `gog` binary)
- Verify ARM64 asset exists before committing: `curl -sI "<url>" | grep HTTP/`

Rebuild the image after editing:

```bash
cd /Users/home/tools/Adamclaw
docker compose down && docker build -t openclaw:local . && docker compose up -d
```

Verify binary is present:

```bash
docker exec adamclaw-openclaw-gateway-1 which <binary>
```

---

## Step 3 — Enable the Skill at Gateway Level

Every skill starts as `enabled: false` in `openclaw.json`. Check current state:

```bash
docker exec adamclaw-openclaw-gateway-1 openclaw skills info <skill-id>
```

If it shows `⏸ Disabled` with `✓ <binary>` (binary found but skill disabled), edit `~/.openclaw/openclaw.json`:

```bash
python3 -c "
import json
path = '/Users/home/.openclaw/openclaw.json'
with open(path) as f:
    c = json.load(f)
c['skills']['entries']['<skill-id>']['enabled'] = True
with open(path, 'w') as f:
    json.dump(c, f, indent=2)
print('done')
"
```

Config hot-reloads — no restart needed. Confirm:

```bash
docker exec adamclaw-openclaw-gateway-1 openclaw skills info <skill-id>
# Should show: ✓ Ready
```

---

## Step 4 — Auth Setup (if required)

Skip this step for binary-only skills.

### OAuth-based skills (pattern established with gog)

The Mac hosts the browser for the OAuth flow; credentials are exported to `~/.openclaw/` (volume-mounted into Docker) and imported into the container.

**On the Mac:**

```bash
# Install the CLI locally for the auth flow
brew install steipete/tap/<formula>

# Set keyring password (must match GOG_KEYRING_PASSWORD in .env)
export GOG_KEYRING_PASSWORD='Th3 dark side of the m00n!'

# Register OAuth client and authorize the account
<tool> auth credentials /path/to/client_secret.json
<tool> auth add <email> --services <scopes>
# Browser opens — complete OAuth flow

# Export token to volume-mounted dir
<tool> auth keyring keychain          # switch to keychain to read existing token
<tool> auth tokens export <email> --out ~/.openclaw/<tool>-token.json
<tool> auth keyring file              # switch back to file backend

# Copy original client_secret.json too
cp /path/to/client_secret.json ~/.openclaw/<tool>-client-secret.json
```

**Inside the container:**

```bash
docker exec adamclaw-openclaw-gateway-1 sh -c '
  <tool> auth keyring file &&
  <tool> auth credentials /home/node/.openclaw/<tool>-client-secret.json &&
  <tool> auth tokens import /home/node/.openclaw/<tool>-token.json
'
```

**Verify:**

```bash
docker exec adamclaw-openclaw-gateway-1 <tool> auth status
# Should show: keyring_backend: file, credentials_exists: true
```

**Clean up credential files** (no longer needed after import):

```bash
rm ~/.openclaw/<tool>-token.json ~/.openclaw/<tool>-client-secret.json
```

The re-downloadable `client_secret.json` (from GCP Console) does not need to be stored locally. The encrypted keyring in `~/.openclaw/.config/<toolname>/` is the only persistent auth artifact.

### API key-based skills

Add the key to `.env` and wire it into `docker-compose.yml` environment, following the same pattern as `GOG_KEYRING_PASSWORD`. Never hardcode secrets.

---

## Step 5 — Per-Agent Access Control

**Important:** `agents.list[].skills` is an **allowlist**, not a denylist. An agent only gets a skill's SKILL.md injected into its system prompt if the skill is explicitly listed in that agent's `skills` array. Without it, the agent can still run the binary via `exec`, but has no skill documentation in context — it will hallucinate or fail to use the tool correctly.

**To grant a skill to an agent** (required for the skill to work properly):

```python
python3 -c "
import json
path = '/Users/home/.openclaw/openclaw.json'
with open(path) as f:
    c = json.load(f)
for agent in c['agents']['list']:
    if agent['id'] == '<agent-id>':
        agent['skills'] = agent.get('skills', []) + ['<skill-id>']
with open(path, 'w') as f:
    json.dump(c, f, indent=2)
print('done')
"
```

Config hot-reloads — no restart needed for the config change itself.

**Critical:** Skills are injected at **session creation time** and cached in the session snapshot. Adding a skill to the allowlist via hot-reload updates the in-memory config but does NOT refresh existing sessions. The agent will continue running without the skill until its session is reset.

**After updating the allowlist, reset the agent's session:**

```bash
# Delete ONLY sessions.json — this resets the routing/snapshot metadata.
# The JSONL conversation transcript is a separate file and is NOT deleted.
rm ~/.openclaw/agents/<agent-id>/sessions/sessions.json
```

On the agent's next message, OpenClaw creates a new session and resolves skills from the current config. Verify by checking that `skillsSnapshot.skills` in the new `sessions.json` contains the skill name.

**To block a skill from an agent:** simply don't include it in that agent's `skills` array.

**Via web UI:** The Skills tab per-agent toggles skills on/off — but verify via `openclaw.json` that the `skills` array reflects what you expect. The UI sets the allowlist and the same session-reset requirement applies.

---

## Step 6 — Test

```bash
# 1. Binary present
docker exec adamclaw-openclaw-gateway-1 which <binary>

# 2. Skill ready
docker exec adamclaw-openclaw-gateway-1 openclaw skills info <skill-id>

# 3. Restart persistence (credentials survive container restart)
docker compose restart openclaw-gateway
docker exec adamclaw-openclaw-gateway-1 <tool> auth status

# 4. End-to-end: message the agent in Telegram and ask them to use the skill
# Tell the agent: "Read your SKILL.md at /app/skills/<skill-id>/SKILL.md"
```

---

## Installed Skills (keep current)

| Skill    | Binary                    | Type             | Auth                               | Agents with access | Notes                                                                              |
| -------- | ------------------------- | ---------------- | ---------------------------------- | ------------------ | ---------------------------------------------------------------------------------- |
| `gog`    | `gog` (gogcli)            | Pre-built binary | OAuth — `EveGenesisClaw@gmail.com` | EveClaw only       | `eveclaw.skills: ["gog"]`                                                          |
| `trello` | `trello` (custom Node.js) | Custom script    | API key + token in `.env`          | EveClaw only       | `skills/trello/trello.js` → `/usr/local/bin/trello`; board IDs hardcoded in script |

---

## Trello API Credential Notes

- The old `https://trello.com/app-key` page now redirects to the Power-Up Admin Portal
- To get credentials: go to https://trello.com/power-ups/admin → create a new Power-Up → the API key is on the integration details page
- Token generation URL still works: `https://trello.com/1/authorize?expiration=never&scope=read,write&response_type=token&name=EveClaw&key=YOUR_API_KEY`
- The "secret" shown on the Power-Up page is not used — only the API key and the generated token are needed

---

## Google Cloud OAuth Notes (gog-specific)

- GCP project: same project used for Gemini API (one project, one billing account)
- OAuth app is in "Testing" mode — any new Google account used must be added as a test user in GCP Console → APIs & Services → OAuth consent screen → Test users
- `client_secret.json` can be re-downloaded from GCP Console → APIs & Services → Credentials at any time
- If re-authorizing, follow Step 4 from scratch; existing keyring entries can be removed with `gog auth remove <email>`
