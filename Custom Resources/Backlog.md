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
