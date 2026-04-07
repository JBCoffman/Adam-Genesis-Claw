# Agent Personalization Fields

This is a working reference for all user-facing fields that control agent identity, personality, and behavior. The system uses two complementary mechanisms: **config fields** (in `openclaw.config.json` or similar) and **workspace files** (markdown files in the agent's workspace directory).

---

## 1. Identity Fields (Config-Based)

These live under `agents.list[].identity` in the agent config.

| Field      | Type     | What It Controls                                                                                       |
| ---------- | -------- | ------------------------------------------------------------------------------------------------------ |
| `name`     | `string` | Display name shown in UI and messages                                                                  |
| `emoji`    | `string` | Signature emoji for the agent                                                                          |
| `theme`    | `string` | Visual theme (color/style hint)                                                                        |
| `creature` | `string` | The agent's "nature" — what kind of being it is (e.g., "a meticulous archivist", "a chaotic tinkerer") |
| `vibe`     | `string` | Personality/energy descriptor (e.g., "warm and methodical", "dry wit, fast")                           |
| `avatar`   | `string` | Avatar image — URL or workspace-relative path                                                          |

These can also be declared in an `IDENTITY.md` file in the agent workspace (see Section 3).

---

## 2. Behavior Fields (Config-Based)

These live under `agents.list[]` directly.

| Field              | Type                                                                         | What It Controls                                               |
| ------------------ | ---------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `model`            | `string \| { primary, fallbacks[] }`                                         | Which AI model the agent uses; fallbacks for resilience        |
| `thinkingDefault`  | `"off" \| "minimal" \| "low" \| "medium" \| "high" \| "xhigh" \| "adaptive"` | Default reasoning depth (affects response quality and latency) |
| `reasoningDefault` | `"on" \| "off" \| "stream"`                                                  | Whether to show reasoning traces                               |
| `fastModeDefault`  | `boolean`                                                                    | Prioritize speed over depth                                    |
| `skills`           | `string[]`                                                                   | Allowlist of skills/tools this agent can use                   |
| `params`           | `Record<string, unknown>`                                                    | Provider-specific API parameters (e.g., temperature, top_p)    |
| `humanDelay`       | `HumanDelayConfig`                                                           | Artificial reply delay — makes the agent feel less robotic     |
| `heartbeat`        | `HeartbeatConfig`                                                            | Scheduled check-in behavior (see below)                        |
| `memorySearch`     | `MemorySearchConfig`                                                         | Controls how the agent searches its memory                     |
| `subagents`        | `SubagentConfig`                                                             | Whether/how this agent can spawn sub-agents                    |
| `sandbox`          | `AgentSandboxConfig`                                                         | Execution sandbox settings                                     |
| `default`          | `boolean`                                                                    | Whether this is the default agent                              |
| `workspace`        | `string`                                                                     | Path to this agent's workspace directory                       |

---

## 3. Workspace Files (File-Based Persona System)

This is where the real personality customization lives. Each agent has a workspace directory containing markdown files that get injected into its system prompt. **These are the most powerful personalization levers.**

| File           | Purpose                                                                                                                                                                                     |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SOUL.md`      | Core identity, values, and boundaries. Think of this as the agent's soul — what it fundamentally is, believes, and how it engages. This is the closest thing to a "system prompt override." |
| `AGENTS.md`    | Behavioral rules, guidelines, and working style. What the agent should and shouldn't do.                                                                                                    |
| `IDENTITY.md`  | Identity metadata: name, emoji, avatar, creature, vibe. Alternative to config-based identity.                                                                                               |
| `USER.md`      | Information about the person the agent serves — their role, preferences, communication style, what they care about.                                                                         |
| `TOOLS.md`     | Tool-specific notes, preferred usage patterns, reminders about specific tools.                                                                                                              |
| `MEMORY.md`    | Long-term memory index (main sessions only).                                                                                                                                                |
| `BOOTSTRAP.md` | First-run setup ritual — what the agent does when it first activates.                                                                                                                       |
| `HEARTBEAT.md` | Checklist/prompt for scheduled heartbeat tasks.                                                                                                                                             |

**Key insight:** The system prompt is OpenClaw-owned and assembled dynamically. You can't replace it wholesale, but these files are injected into it — giving you fine-grained control over identity and behavior without touching system internals.

---

## 4. Heartbeat Config (Per-Agent Scheduled Behavior)

Heartbeats let an agent "wake up" on a schedule and take action. Fields under `agents.list[].heartbeat`:

| Field              | Type                       | What It Controls                                              |
| ------------------ | -------------------------- | ------------------------------------------------------------- |
| `every`            | `string` (duration)        | How often the heartbeat fires (e.g., `"1h"`, `"30m"`)         |
| `activeHours`      | `{ start, end, timezone }` | Time window when heartbeats are active                        |
| `model`            | `string`                   | Model to use for heartbeat tasks (can differ from main model) |
| `prompt`           | `string`                   | What the agent does when it wakes up                          |
| `target`           | `string`                   | Where heartbeat output is sent                                |
| `to`               | `string`                   | Message recipient for heartbeat messages                      |
| `isolatedSession`  | `boolean`                  | Whether heartbeat runs in its own session                     |
| `lightContext`     | `boolean`                  | Reduced context for faster/cheaper heartbeats                 |
| `includeReasoning` | `boolean`                  | Include reasoning traces in heartbeat output                  |

---

## 5. Global Defaults (Apply to All Agents Unless Overridden)

These live under `agents.defaults` and set the baseline for all agents:

| Field             | What It Controls                                     |
| ----------------- | ---------------------------------------------------- |
| `model`           | Default model for all agents                         |
| `thinkingDefault` | Default thinking level                               |
| `humanDelay`      | Default reply delay behavior                         |
| `heartbeat`       | Default heartbeat config                             |
| `memorySearch`    | Default memory search config                         |
| `userTimezone`    | Injected into system prompt for time-aware responses |
| `timeFormat`      | 12h or 24h time in system prompt                     |
| `contextPruning`  | How context windows are managed                      |
| `compaction`      | Session compaction settings                          |

---

## 6. Fields That Don't Exist Yet (Proposed)

These are natural extensions that would make sense to expose in a UI for deep personalization. None of these exist today — they'd require implementation:

| Field                   | Type                                               | What It Would Control                                               |
| ----------------------- | -------------------------------------------------- | ------------------------------------------------------------------- |
| `systemPromptAppend`    | `string`                                           | Append arbitrary text to system prompt without managing a file      |
| `tone`                  | `"formal" \| "casual" \| "technical" \| "playful"` | Quick tone preset (translates to SOUL.md injection)                 |
| `verbosity`             | `"terse" \| "normal" \| "detailed"`                | How much the agent explains itself                                  |
| `proactivity`           | `"reactive" \| "balanced" \| "proactive"`          | Whether the agent offers unsolicited suggestions                    |
| `responseStyle`         | `"prose" \| "lists" \| "mixed"`                    | Preferred output formatting style                                   |
| `contextWindowBehavior` | `"aggressive" \| "conservative"`                   | How aggressively to prune old context                               |
| `defaultLanguage`       | `string`                                           | Preferred response language                                         |
| `signaturePhrase`       | `string`                                           | Phrase the agent always includes (sign-off, catchphrase)            |
| `tabooTopics`           | `string[]`                                         | Topics this agent should never engage with                          |
| `expertiseAreas`        | `string[]`                                         | Domains this agent is "expert" in — affects how it frames knowledge |

---

## Iteration Notes

- The `SOUL.md` + `IDENTITY.md` combination is the most powerful existing mechanism for unique personalities.
- `creature` + `vibe` are underutilized fields with high potential for differentiation.
- `skills` allowlisting is the primary security lever — use it to scope what each agent can do.
- `humanDelay` is a subtle but effective personality signal (fast agents feel different from deliberate ones).
- The proposed fields in Section 6 would be most impactful to implement for a UI-driven agent builder.
