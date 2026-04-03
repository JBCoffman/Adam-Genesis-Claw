# Agent Differentiation — Technical Overview

## What is "the System" vs. "an Agent"

The system is the runtime: the gateway process, the LLM inference loop, channel integrations, tool engine, memory/compaction pipeline, and cron scheduler. All of this is shared infrastructure. None of it is what makes one agent different from another.

An **agent** is a named configuration profile that rides on top of that shared runtime. It controls which workspace the agent operates in, what personality it carries, which model it uses, which tools it can access, how it wakes up on its own, and how it identifies itself across channels. Two agents running on the same gateway can be completely different products.

---

## The Five Dimensions of Agent Differentiation

### 1. Soul & Personality

This is the most impactful layer. Three workspace files are injected into the system prompt at runtime under `# Project Context`:

| File | Role |
|---|---|
| `SOUL.md` | **Persona definition.** If present, the agent is explicitly instructed: *"embody its persona and tone. Avoid stiff, generic replies; follow its guidance unless higher-priority instructions override it."* This is the primary personality lever. |
| `AGENTS.md` | **Behavioral rules and red lines.** Session startup sequences, things the agent must never do, domain-specific constraints, memory/tool usage conventions. |
| `TOOLS.md` | **Tool usage preferences.** How the agent should use specific tools (e.g. prefer `rg` over `grep`). |

These files live in the agent's **workspace directory** (`agents.list[].workspace`) so each agent gets its own set. Changing these files changes the agent's character without touching any code.

The `extraSystemPrompt` field injects additional context at runtime — used for group chat framing, subagent context, and post-compaction refresh instructions.

---

### 2. Identity & Presence

Identity controls how the agent presents itself in messaging surfaces. Configured under `agents.list[].identity`:

| Field | What it does |
|---|---|
| `name` | Display name, appears as `[AgentName]` prefix on outbound messages |
| `emoji` | Used as the default acknowledgment reaction when no explicit ackReaction is set |
| `ackReaction` | The emoji reacted to incoming messages to signal "I see this" |
| `responsePrefix` | Custom text prefix prepended to every reply (can be `"auto"` to use name) |

Identity resolution is **layered**: channel-account level → channel level → global messages config → agent identity → system default (`👀`). More specific settings always win.

`reactionGuidance` is a separate runtime flag (`minimal` or `extensive`) that tells the agent how liberally to use emoji reactions — separate from the ackReaction, this shapes conversational warmth.

---

### 3. Model & Reasoning

Each agent can target a specific model independently of others. Configured under `agents.list[].model`:

| Setting | What it controls |
|---|---|
| `model.primary` | The main LLM model (e.g. `claude-opus-4-6`, `gpt-5.4`) |
| `model.fallbacks` | Ordered list of fallback models if primary fails or is unavailable |
| `thinkingDefault` | Default thinking/CoT depth: `off`, `minimal`, `low`, `medium`, `high`, `xhigh`, `adaptive` |
| `reasoningDefault` | Whether extended reasoning (visible `<think>` tags) is on by default |
| `fastModeDefault` | Whether fast mode is enabled by default |

System-wide defaults live in `agents.defaults.model`. Per-agent settings override them. A subagent spawned by an agent can also inherit a different model via `agents.defaults.subagents.model`.

The global hardcoded baseline (if nothing is configured) is `claude-opus-4-6` via `src/agents/defaults.ts`.

---

### 4. Capabilities & Tool Access

Tool availability is **filtered by policy** before being presented in the system prompt. Each agent sees only the tools it is authorized to use. Configured under `agents.list[].tools` and `agents.list[].sandbox`:

**Tool policy** controls:
- Which tools appear in the system prompt (the agent can only use what it sees)
- Whether elevated exec (host shell with approvals) is available
- Whether the agent runs in a **sandboxed Docker container** — fully isolated with its own filesystem, browser bridge, and optional elevated escape hatch

**Sandbox differentiation:**
- `sandbox.enabled: true` — agent runs tools inside a Docker container, not on the host
- `sandbox.workspaceAccess` — whether the agent can reach the host workspace from the container
- `sandbox.elevated` — whether the agent can request host-level execution
- `sandbox.hostBrowserAllowed` — whether the agent can control the host browser

**Skills** are a separate capability layer. Each agent gets a filtered list of available skills (`agents.list[].skills`). Skills are read-only instruction files (SKILL.md) the agent consults before executing specific workflows. They gate what the agent knows how to do in a structured, auditable way.

**Subagent spawning:**
- `subagents.maxSpawnDepth` — how many levels deep an agent can spawn child agents (default: 1, max: 5)
- `subagents.maxChildrenPerAgent` — how many concurrent children a single session can spawn (default: 5)
- `subagents.requireAgentId` — whether `sessions_spawn` must name a specific agent

---

### 5. Heartbeat & Autonomous Behavior

Heartbeat is what makes an agent proactive rather than purely reactive. Without it, the agent only wakes up when a user sends a message. With it, the system pings the agent on a schedule and the agent decides whether anything needs attention.

Configured under `agents.list[].heartbeat` (or `agents.defaults.heartbeat`):

| Setting | What it controls |
|---|---|
| Heartbeat prompt | The text sent to the agent on each scheduled wake-up (sets the context/mood for the poll) |
| Schedule | Cron expression controlling when wake-ups happen |
| `HEARTBEAT_OK` | The token the agent replies with when nothing needs attention — system suppresses delivery silently |

If the agent replies with anything other than `HEARTBEAT_OK`, it is treated as a real message and delivered to the user. This is how an agent proactively sends alerts, summaries, or reminders on its own initiative.

The heartbeat prompt text is injected into the system prompt under `## Heartbeats`, so the agent knows what a heartbeat looks like and how to respond to it.

`humanDelay` is related: it adds a configurable min/max delay before the agent sends replies, simulating more natural response timing. Per-agent, with global defaults.

---

## Routing: Which Messages Go to Which Agent

When multiple agents are configured, **bindings** control which incoming conversations are routed to which agent.

| Binding type | What it does |
|---|---|
| `route` binding | Matches on channel + peer (DM/group/channel) + optional role/guild/team filters → routes to `agentId` |
| `acp` binding | Like route, but spawns an ACP harness session (external coding agent like Claude Code) instead of the embedded agent |

If no binding matches, the message goes to the **default agent** (first entry with `default: true`, otherwise the first entry in the list).

This means the same gateway can serve completely different agents on different channels, different group chats, or even different roles within the same channel.

---

## Summary: What You Change to Change an Agent

| To change... | Edit... |
|---|---|
| Personality, tone, voice | `SOUL.md` in the agent's workspace |
| Behavioral rules, red lines | `AGENTS.md` in the agent's workspace |
| Display name and emoji | `agents.list[].identity` in config |
| Which LLM model it uses | `agents.list[].model` in config |
| How deeply it reasons | `agents.list[].thinkingDefault` in config |
| What tools it can access | `agents.list[].tools` + `sandbox` in config |
| What workflows it knows | Skills filter: `agents.list[].skills` in config |
| When it wakes up on its own | `agents.list[].heartbeat` in config |
| Which conversations it handles | `bindings` array in config |
| Its persistent memory | `MEMORY.md` and `memory/` directory in workspace |
