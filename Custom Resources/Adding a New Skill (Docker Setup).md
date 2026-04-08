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

By default all agents can use all enabled skills. To restrict a skill to specific agents:

**Via web UI (recommended):**

1. Go to `127.0.0.1:18789/agents`
2. Select the agent to block
3. Skills tab → toggle the skill off
4. This creates a per-agent denylist for that agent only

**Via `openclaw.json`** (for config-as-code):

```json
{
  "id": "adamclaw",
  "skills": {
    "deny": ["gog", "<other-skill>"]
  }
}
```

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

| Skill | Binary         | Auth                               | Agents with access | Notes                      |
| ----- | -------------- | ---------------------------------- | ------------------ | -------------------------- |
| `gog` | `gog` (gogcli) | OAuth — `EveGenesisClaw@gmail.com` | EveClaw only       | AdamClaw denied via web UI |

---

## Google Cloud OAuth Notes (gog-specific)

- GCP project: same project used for Gemini API (one project, one billing account)
- OAuth app is in "Testing" mode — any new Google account used must be added as a test user in GCP Console → APIs & Services → OAuth consent screen → Test users
- `client_secret.json` can be re-downloaded from GCP Console → APIs & Services → Credentials at any time
- If re-authorizing, follow Step 4 from scratch; existing keyring entries can be removed with `gog auth remove <email>`
