# Agent Session Management

Reference for understanding and managing agent sessions in the Docker-based OpenClaw setup.

---

## Session File Structure

Each agent has two separate files per session under `~/.openclaw/agents/<agent-id>/sessions/`:

| File                 | What it contains                                                    | Safe to delete?                                                 |
| -------------------- | ------------------------------------------------------------------- | --------------------------------------------------------------- |
| `sessions.json`      | Routing metadata, skills snapshot, model config, session ID mapping | Yes — forces a new session on next message; history is NOT lost |
| `<session-id>.jsonl` | Full conversation transcript (every turn, tool call, and response)  | Careful — this is the actual history                            |

These are independent. Deleting `sessions.json` does not touch the JSONL transcript.

---

## Skills Snapshot

When a session is first created, OpenClaw resolves which skills the agent has access to (based on `agents.list[].skills` allowlist + `skills.entries.<id>.enabled`) and caches the result in `sessions.json` as `skillsSnapshot`.

**This snapshot is NOT refreshed by hot-reload.** If you add a skill to an agent's allowlist after the session already exists, the agent won't have that skill in its system prompt until the session is reset — even if the config hot-reload fires and confirms `config change applied`.

Proof: `systemPromptReport.skills.entries` in `sessions.json` shows which skills are actually injected. If it's empty, the agent has no skill documentation in context and will hallucinate or fail to use the tool correctly.

### How to add a skill to a running agent

1. Add the skill to `agents.list[].skills` in `openclaw.json` (see Adding a New Skill guide, Step 5)
2. Verify the hot-reload fired: `docker logs adamclaw-openclaw-gateway-1 | grep reload`
3. Reset the session: `rm ~/.openclaw/agents/<agent-id>/sessions/sessions.json`
4. Send the agent a message — new session is created with skills resolved from current config
5. Verify: check that `sessions.json` now has `skillsSnapshot.skills` containing the skill name

---

## When to Reset a Session

Reset `sessions.json` when:

- Adding a new skill to an agent's allowlist
- Removing a skill from an agent's allowlist
- Making significant agent config changes that don't seem to take effect

Do NOT reset when:

- Updating workspace files (SOUL.md, TOOLS.md, AGENTS.md, etc.) — these are volume-mounted and injected fresh on every turn
- Updating `openclaw.json` fields that hot-reload handles correctly (model, bindings, etc.)

---

## openclaw-cli Container

The `openclaw-cli` service in `docker-compose.yml` is a **companion CLI tool**, not a persistent service. It has no default command, so it exits immediately on `docker compose up`. This is **expected and normal**.

Use it to run administrative CLI commands against the live gateway:

```bash
docker compose run --rm openclaw-cli openclaw sessions --all-agents
docker compose run --rm openclaw-cli openclaw skills list
docker compose run --rm openclaw-cli openclaw pairing approve telegram <code>
```

The container sharing `network_mode: "service:openclaw-gateway"` means commands reach the gateway via `localhost:18789`.

---

## Gmail Watcher

The gateway runs a background `[gmail-watcher]` process when the gog skill is active for an agent. This watcher handles push-style email notifications.

**Behavior:**

- Logs `gmail watcher stopped` on shutdown or config reload
- Does NOT log a "started" message — silence means it's running
- Stops and restarts automatically when `skills.entries.gog.enabled` changes

If the watcher appears absent after a container restart, verify that:

1. `skills.entries.gog.enabled: true` in `openclaw.json`
2. The agent has gog in its `skills` allowlist
3. gog credentials are valid: `docker exec adamclaw-openclaw-gateway-1 gog auth status --account EveGenesisClaw@gmail.com`

---

## Verifying Skills Are Injected

After a session reset, confirm the skill is working:

```bash
python3 -c "
import json
with open('/Users/home/.openclaw/agents/<agent-id>/sessions/sessions.json') as f:
    d = json.load(f)
for k, v in d.items():
    snap = v.get('skillsSnapshot', {})
    report = v.get('systemPromptReport', {})
    print('skills snapshot:', snap.get('skills'))
    print('injected skills:', report.get('skills', {}).get('entries'))
    print('prompt chars:', report.get('systemPrompt', {}).get('chars'))
"
```

Expected after successful gog injection:

- `skills snapshot: [{'name': 'gog', ...}]`
- `injected skills: [{'name': 'gog', 'blockChars': ~197}]`
- `prompt chars` increased by ~1200 compared to without skill
