# Eve Troubleshooting Guide

A practical reference for diagnosing and fixing Eve (EveClaw) issues. Written for a Claude Code session starting cold with no prior context.

---

## System Overview (Read First)

Eve is an openclaw agent running inside a Docker container on this machine. She receives messages via Telegram, processes them through a Gemini Flash Lite model, and executes tools (primarily `gog` for Gmail and Google Calendar).

### Key paths

| What                                | Path                                                                   |
| ----------------------------------- | ---------------------------------------------------------------------- |
| Agent config (model, tools, skills) | `~/.openclaw/openclaw.json` → `agents.list[]` where `id: "eveclaw"`    |
| Workspace files (instructions)      | `~/.openclaw/agents/eveclaw/workspace/`                                |
| Session history (JSONL)             | `~/.openclaw/agents/eveclaw/sessions/`                                 |
| Docker container                    | `openclaw` (or check `docker ps`)                                      |
| Kymba proxy (cost tracking)         | `http://host.docker.internal:9099/google/v1` — routes Google API calls |

### How the system prompt is built

openclaw injects workspace files verbatim into the system prompt in this order:
`SOUL.md` → `AGENTS.md` → `TOOLS.md` → `USER.md` → `HEARTBEAT.md`

The model's behavior is entirely driven by these files. If Eve is acting wrong, the first question is always: **did the instructions tell her to do that?**

### Provider routing

Eve uses the Google provider via Kymba. Her config in `openclaw.json`:

```json
{
  "id": "eveclaw",
  "model": { "id": "gemini-2.5-flash-lite", "provider": "google", "api": "openai-completions" },
  "thinkingDefault": "low"
}
```

`api: "openai-completions"` means Google's OpenAI-compat endpoint. This matters for reasoning behavior (see Known Issues below).

---

## Diagnostic Workflow

When something is wrong, run through this in order:

### Step 1 — Identify the active session

```bash
ls -lt ~/.openclaw/agents/eveclaw/sessions/*.jsonl | head -5
```

The most recently modified file is the active session. Note its path.

### Step 2 — Read the last N assistant messages

```bash
tail -n 30 ~/.openclaw/agents/eveclaw/sessions/<session-id>.jsonl
```

Each line is a JSON object. Look at `role` and `content`. You're looking for:

- `role: "assistant"` messages with `<tool_code>` blocks — **session poisoning**
- `role: "assistant"` messages with `<final>` tags — **stale instruction artifact**
- Tool calls that use wrong syntax (e.g. `gog calendar create "Title"` without a calendarId first)
- Error responses from tools that Eve ignored or mishandled

### Step 3 — Check the workspace files

```bash
cat ~/.openclaw/agents/eveclaw/workspace/AGENTS.md
cat ~/.openclaw/agents/eveclaw/workspace/TOOLS.md
```

Verify:

- The `## Response Format — Gemini-Specific Workaround` section does NOT exist in AGENTS.md (it was obsolete and caused `<tool_code>` failures — if it's back, delete it)
- TOOLS.md has `gog calendar create <calendarId>` syntax with the calendarId clearly first
- No duplicate email security rules between USER.md and TOOLS.md

### Step 4 — Check if Kymba is running

```bash
curl -s http://localhost:9099/health 2>/dev/null || echo "Kymba not responding"
```

If Kymba is down, Eve's API calls fail silently or route incorrectly. Restart via the Kymba Mac app (not manually — the app manages the process).

### Step 5 — Check openclaw Docker container

```bash
docker ps | grep openclaw
docker logs openclaw --tail 50
```

If the container is stopped, restart it: `docker start openclaw`

---

## Known Issues & Fixes

### Issue: Eve outputs `<tool_code>` blocks instead of using tools

**Symptom:** Eve responds with Python-style code like `default_api.write(...)` or `default_api.exec(...)` instead of calling real tools. Tools never execute.

**Root cause (historical):** The `## Response Format — Gemini-Specific Workaround` section in AGENTS.md instructed Eve to wrap output in `<final>` tags. The `<think>/<final>` system prompt injection from openclaw combined with this caused Gemini Flash Lite to fall back to code-execution mode.

**Fix applied (permanent):** `src/utils/provider-utils.ts` → `resolveReasoningOutputMode()` now returns `"native"` for Google models when `modelApi === "openai-completions"`, preventing `<think>/<final>` injection entirely.

**If it happens again:**

1. Check AGENTS.md — delete any `<think>/<final>` or `<final>` tag instructions immediately
2. Clear the session (see "Clearing a Poisoned Session" below)
3. Verify the fix in `provider-utils.ts` is still present:
   ```bash
   grep -A 3 "openai-completions" /Users/home/tools/Adamclaw/src/utils/provider-utils.ts
   ```
   Should return `return "native";` inside the Google branch.

---

### Issue: Session history is poisoned

**Symptom:** Eve keeps repeating bad behavior (wrong tool syntax, `<tool_code>` blocks) even after fixing workspace files.

**Root cause:** The session JSONL contains past `assistant` messages with the bad pattern. Gemini uses conversation history as in-context examples and learns from it — bad history → bad continuation.

**Fix:** Clear (truncate) the active session file.

```bash
# Backup first
cp ~/.openclaw/agents/eveclaw/sessions/<id>.jsonl \
   ~/.openclaw/agents/eveclaw/sessions/<id>.jsonl.bak

# Clear it
truncate -s 0 ~/.openclaw/agents/eveclaw/sessions/<id>.jsonl
```

Eve will start fresh on the next message with a clean slate.

**If full clear is too aggressive** (you want to preserve recent good history), find and remove only the poisoned lines:

```bash
# View line-by-line to find bad messages
cat -n ~/.openclaw/agents/eveclaw/sessions/<id>.jsonl | grep -n "tool_code\|<final>"
```

Remove those specific lines with a targeted write. Session lines are append-only newline-delimited JSON — removing a line is safe as long as you preserve valid JSON objects on remaining lines.

---

### Issue: `gog calendar create` fails or creates event with wrong title

**Symptom:** Calendar event isn't created, or the `--summary` value ends up as the calendar ID argument.

**Root cause:** `gog calendar create` syntax is `gog calendar create <calendarId> --summary "Title"`. The calendar ID must come immediately after `create`, before any flags. If Eve passes the title first, the command fails or misroutes.

**Fix:**

1. Check TOOLS.md — the Calendar section must show:
   ```
   SYNTAX: gog calendar create <calendarId> --summary "Title" --from <iso> --to <iso>
   ```
   with `EveGenesisClaw@gmail.com` as the explicit calendarId in examples.
2. Clear the session if Eve has established a wrong pattern.
3. Check `memory/lessons.md` — the `gog calendar create all-day events` lesson should be present.

---

### Issue: Eve uses email received date as the event date

**Symptom:** Calendar event is created for the wrong date (the date Jake forwarded the email, not the actual event date).

**Root cause:** Gemini Flash Lite shortcuts to the most readily available date in context (the email header) rather than parsing the body/attachment for the actual event date.

**Fix:**

- Verify AGENTS.md contains: _"never use email received date as event date"_ (in the Email → Calendar section)
- Verify TOOLS.md Event Quality Rules contains the same warning
- Verify `memory/lessons.md` has the Calendar date accuracy lesson
- If the event was created wrong, delete it: `gog calendar delete EveGenesisClaw@gmail.com <eventId> --force --account EveGenesisClaw@gmail.com`

---

### Issue: Kymba proxy is not responding (Mac app alert)

**Symptom:** Kymba Mac app shows "proxy is not responding." Eve's API calls fail.

**Root cause (historical):** A manually started debug binary was left running, conflicting with the app-managed process.

**Fix:**

1. Do not kill Kymba processes manually — the Mac app owns the process lifecycle
2. In the Kymba Mac app: click "Restart Proxy"
3. Verify in Xcode console or `ps aux | grep kymba` that only one proxy process is running
4. Never start a custom kymba binary while the app is also managing one

---

### Issue: Eve doesn't pick up new workspace file changes

**Symptom:** You updated AGENTS.md or TOOLS.md but Eve's behavior didn't change.

**Root cause:** The session history shows the old behavior and overrides the new instructions (Gemini gives in-context examples more weight than system prompt for behavioral patterns).

**Fix:** Clear the active session after updating workspace files. Changes take effect on the next fresh conversation.

---

## File Edit Patterns

### Updating AGENTS.md / TOOLS.md / SOUL.md

These files are plain text. Edit with the `Edit` or `Write` tool directly. Changes take effect on Eve's next session (clear the session to force immediate effect).

### Updating MEMORY.md (the index file)

**Never use `Edit` on MEMORY.md** — Gemini paraphrases when building `old_string`, causing exact-match failures. Always:

1. Backup: `exec cp MEMORY.md memory/MEMORY-backup-$(date -u +%Y-%m-%dT%H-%M-%S).archive`
2. Read the full file
3. `Write` the entire file with changes
4. Read it back to verify

### Adding a lesson to `memory/lessons.md`

Adam owns this file during curation runs, but you can edit it directly when fixing an issue. Format:

```markdown
- **Short label:** What happened, what the rule is, and what to do instead.
```

### Adding to Eve's learning pipeline

Append to `~/.openclaw/agents/eveclaw/workspace/memory/adam-queue.md`:

```markdown
[YYYY-MM-DD Eve] <note about what to remember or improve>
```

Adam picks this up during weekly curation and promotes it to `preferences.md`, `lessons.md`, or `dreams.md` as appropriate. The file was renamed from `INBOX.md` to `adam-queue.md` to prevent Eve from confusing it with her Gmail inbox.

---

## Quick Reference — Common Commands

```bash
# Find active session
ls -lt ~/.openclaw/agents/eveclaw/sessions/*.jsonl | head -3

# Read last 20 lines of active session
tail -n 20 ~/.openclaw/agents/eveclaw/sessions/<id>.jsonl

# Clear active session (always backup first)
cp ~/.openclaw/agents/eveclaw/sessions/<id>.jsonl ~/.openclaw/agents/eveclaw/sessions/<id>.jsonl.bak
truncate -s 0 ~/.openclaw/agents/eveclaw/sessions/<id>.jsonl

# Check Eve's agent config
cat ~/.openclaw/openclaw.json | python3 -m json.tool | grep -A 20 '"id": "eveclaw"'

# Check Kymba proxy
curl -s http://localhost:9099/health

# Check Docker container
docker ps | grep openclaw
docker logs openclaw --tail 50

# Verify the <think>/<final> fix is in place
grep -A 5 "openai-completions" /Users/home/tools/Adamclaw/src/utils/provider-utils.ts

# Read all workspace files (to understand current instructions)
cat ~/.openclaw/agents/eveclaw/workspace/AGENTS.md
cat ~/.openclaw/agents/eveclaw/workspace/TOOLS.md
cat ~/.openclaw/agents/eveclaw/workspace/memory/lessons.md
```

---

## Architecture Notes for Context

- **Eve's Docker image** is built from `/Users/home/tools/Adamclaw`. When workspace files change, no rebuild is needed — they're mounted or copied in. When openclaw source changes (e.g. `src/utils/provider-utils.ts`), rebuild with `docker cp dist/. openclaw:/app/dist/` + `docker restart openclaw` (avoids full rebuild).
- **Kymba** (`/Users/home/Kymba`) is a Go proxy that routes API calls and tracks token costs. It strips OpenAI-specific fields (`store`, `metadata`) that Google rejects. It does NOT modify `reasoning_effort` or inject any fields — it's a transparent pass-through for everything else.
- **Adam (AdamClaw)** is a separate agent that runs curation on Eve's INBOX.md and promotes learnings to her long-term memory files. If INBOX.md has accumulated items, check with Jake about running Adam's curation workflow.
