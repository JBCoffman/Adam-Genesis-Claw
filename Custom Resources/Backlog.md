# Backlog

Parked ideas and future projects. Enough context to form a proper project later.

---

## Gateway Status CLI

**Problem:** `openclaw gateway status` is noisy and unreliable in Docker because it expects a systemd environment. Key info (channels, agents, plugins) is missing or buried in systemd warnings.

**Value:** A single command that gives a clean, complete picture of the stack — gateway health, Telegram connection, active agents, loaded plugins — without noise. Useful for daily sanity checks and troubleshooting.

**What we know:**

- `gateway status` RPC probe is the only reliable signal from that command in Docker
- `openclaw channels status --probe` gives live Telegram connection state
- `openclaw agents list` and `openclaw plugins list` fill in the rest
- A composite shell script (`status.sh`) could assemble all of this cleanly
- Could live alongside `test-logger.sh` and `view-logs.sh` in the repo root

**Open questions:**

- Should this be a script or a Docker alias?
- Should it output machine-readable (JSON) or human-readable?
- Any other signals worth including (memory usage, uptime, last conversation timestamp)?

---

## Trello Skill — ClawhHub Packaging

**Context:** Eve's Trello integration is fully working (create, assign, move, archive, comment via the `trello` CLI). The CLI is a custom Node.js script baked into the Docker image — not an installable npm package.

**Value:** Packaging it as a proper OpenClaw plugin and publishing to ClawhHub would let any OpenClaw instance install it via `openclaw install trello` instead of the current manual Dockerfile + credentials setup.

**What it would take:**

- Port `skills/trello/trello.js` into an OpenClaw plugin package structure
- Publish to ClawhHub with proper manifest (`openclaw.plugin.json`)
- Handle credential setup flow (API key + token) via OpenClaw's auth/config pattern
- Write install docs

**Current state:** Credential values are hardcoded as env vars in `.env` → `docker-compose.yml`. A proper plugin would surface these through OpenClaw's `config set` flow.

**Open questions:** Should the board ID and member ID be configurable at install time, or discovered dynamically via the API?

---

## Repo / Directory Naming Cleanup

**Problem:** The local folder is `/Users/home/tools/Adamclaw/` and the GitHub repo is `JBCoffman/Adam-Genesis-Claw`. Both carry the agent's name at the infrastructure level, which is confusing since AdamClaw is one specific agent (alongside EveClaw, and any future agents). The top-level container should reflect the platform (OpenClaw), not an individual agent.

**Value:** Cleaner mental model — the repo/folder is the OpenClaw personal instance, agents live inside it.

**What needs to change:**

- Rename local folder: `/Users/home/tools/Adamclaw/` → `/Users/home/tools/Openclaw/`
- Rename GitHub repo: `Adam-Genesis-Claw` → something like `openclaw-home` or `openclaw-config`
- Update git remote URL after rename: `git remote set-url origin <new-url>`
- Update 4 files in the repo (only references to repo/folder name, not agent IDs):
  - `README.md` — heading
  - `Custom Resources/New Machine Setup Guide.md` — 3 occurrences of `Adam-Genesis-Claw`
  - `Custom Resources/Adding a New Agent.md` — 2 occurrences of `/path/to/Adam-Genesis-Claw`
  - `Custom Resources/openclaw-logger User Guide.md` — 1 occurrence of `Adamclaw/`

**What does NOT change:** `adamclaw` / `eveclaw` agent IDs, config keys, workspace paths — those are correct as-is.
