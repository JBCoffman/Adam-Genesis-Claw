# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> Full project rules, commit conventions, coding style, and safety guardrails live in the root `CLAUDE.md` / `AGENTS.md`. Read that first. This file adds architectural orientation on top of it.

---

## Commands

```bash
pnpm install          # install deps (prefer pnpm; bun install also works)
pnpm check            # lint + typecheck — default local gate for every edit
pnpm format:fix       # auto-fix formatting (oxfmt)
pnpm build            # full build + type-check; required before pushing if touching module/publish surfaces
pnpm test             # full test suite (vitest, forks pool)
pnpm test -- <path> -t "<name>"   # run a single test file or test case
pnpm test:coverage    # test with V8 coverage (70% threshold)
pnpm openclaw ...     # run CLI in dev (bun-backed)
```

**Gate ladder:** `pnpm check` → `pnpm test` → `pnpm build` (only if touching build/publish surfaces). Pre-commit hook covers format + check automatically; `FAST_COMMIT=1` skips it when you've already verified manually.

---

## Architecture Overview

OpenClaw is an AI assistant runtime: it connects messaging channels (Telegram, Discord, Slack, Signal, iMessage, WhatsApp, Matrix, and more) to LLM inference, and runs agents that can use tools, spawn subagents, and wake up on a schedule.

### Runtime Shape

```
Gateway process
  ├── Channel integrations  (src/telegram, src/discord, src/slack, src/signal, src/imessage, src/web, ...)
  ├── Routing layer         (src/routing) — maps inbound messages → agent
  ├── Agent runner          (src/agents/pi-embedded-runner/run.ts) — model calls, failover, tool loop
  ├── Plugin system         (src/plugins) — discovery, manifest validation, loader, registry
  ├── Tool engine           (src/agents/pi-tools.ts, src/agents/tool-policy.ts)
  ├── Cron / Heartbeat      (src/infra/heartbeat-runner.ts, src/cron/service.ts)
  └── Media pipeline        (src/media)
```

The gateway runs as the macOS menubar app. There is no separate LaunchAgent. Restart via the app or `scripts/restart-mac.sh`.

### Agent = Config Profile + Workspace Directory

An agent is not code — it is a named entry in `agents.list[]` plus a workspace directory containing markdown files. Two agents on the same gateway can be completely different products.

**The five differentiation layers (in order of impact):**

| Layer | Where it lives |
|-------|---------------|
| Soul & Personality | `SOUL.md` in the agent workspace (injected verbatim into system prompt) |
| Behavioral rules | `AGENTS.md` in the agent workspace |
| Identity & presence | `agents.list[].identity` — name, emoji, ackReaction, responsePrefix |
| Model & reasoning | `agents.list[].model`, `thinkingDefault`, `reasoningDefault`, `fastModeDefault` |
| Capabilities | `agents.list[].tools`, `.sandbox`, `.skills` (allowlist) |

See `Custom Resources/Agent Differentiation — Technical Overview.md` and `Custom Resources/Agent Personalization Fields.md` for the full field reference.

### Key Source Files

| File | What it does |
|------|-------------|
| `src/agents/system-prompt.ts` | Assembles the final system prompt from config + workspace files |
| `src/agents/agent-command.ts` | High-level orchestration, session routing |
| `src/agents/pi-embedded-runner/run.ts` | Model call loop, failover, tool execution |
| `src/agents/identity.ts` | Name, emoji, ack reactions, display |
| `src/config/types.agents.ts` | `AgentConfig` type — all per-agent config fields |
| `src/config/types.agent-defaults.ts` | Global defaults that agents inherit |
| `src/config/zod-schema.agents.ts` | Zod validation for agent config |
| `src/plugins/types.ts` | Plugin and provider type contracts |
| `src/plugin-sdk/core.ts` | Public plugin SDK surface |
| `src/gateway/protocol/schema.ts` | Gateway wire protocol types |

### Plugin / Extension Boundaries (Critical)

- **Extensions import only `openclaw/plugin-sdk/*`** plus their own `api.ts` / `runtime-api.ts`. Never import `src/**` directly from a plugin.
- **Core never deep-imports plugin internals.** If core needs something from a bundled plugin, it goes through the plugin's `api.ts`.
- **Provider plugins** own all provider-specific behavior. Core owns the generic inference loop only.
- New seams must be additive and versioned — third-party plugins are in the wild.

### Workspace Files Injected Into System Prompt

| File | Injected as |
|------|------------|
| `SOUL.md` | Primary persona definition |
| `AGENTS.md` | Behavioral rules |
| `TOOLS.md` | Tool usage preferences |
| `USER.md` | Information about the user being served |
| `HEARTBEAT.md` | Checklist for scheduled heartbeat tasks |
| `BOOTSTRAP.md` | First-run ritual |

### Routing

Incoming messages hit the routing layer (`src/routing`), which matches bindings to find the target agent. `route` bindings match on channel + peer. `acp` bindings spawn an external coding agent (Claude Code) instead of the embedded runner. If no binding matches, the default agent (`default: true`) handles it.

### Config Schema Drift

If you change agent config fields or the public Plugin SDK surface:
- Config: `pnpm config:docs:gen` / `pnpm config:docs:check`
- Plugin SDK: `pnpm plugin-sdk:api:gen` / `pnpm plugin-sdk:api:check`
- Generated baselines live in `docs/.generated/`

---

## Custom Resources Folder

This folder (`Custom Resources/`) is a personal reference layer — architecture notes, personalization specs, and first-principles documents maintained by the operator. It is not part of the build or test pipeline. Files here inform agent design decisions and UI planning but do not affect runtime behavior.

| File | Contents |
|------|---------|
| `Agent Differentiation — Technical Overview.md` | Deep dive on the five agent differentiation dimensions |
| `Agent Personalization Fields.md` | Full field reference for agent identity + behavior config |
| `Architecture Notes.md` | Tiered file map of the most important source files |
| `OpenClaw Token Optimization...md` | First-principles spec for minimizing token usage |
| `Eve Troubleshooting Guide.md` | Diagnostic workflow, known issues, and fix patterns for EveClaw |
