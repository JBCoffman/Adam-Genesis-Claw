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
