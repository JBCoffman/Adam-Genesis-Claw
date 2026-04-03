# Architecture Notes

## Key Files: Agent Behavior & Configuration

### Tier 1 — Core Execution
| File | What it controls |
|---|---|
| `src/agents/pi-embedded-runner/run.ts` | Main agent execution loop, model selection, failover |
| `src/agents/agent-command.ts` | High-level orchestration, session routing |
| `src/agents/system-prompt.ts` | Builds the full system prompt — instructions, skills, memory, behavioral directives |

### Tier 2 — Identity & Soul
| File | What it controls |
|---|---|
| `src/agents/identity.ts` | Agent name, emoji, acknowledgment reactions, display |
| `src/agents/prompt-composition-scenarios.ts` | How prompts are shaped for different agent types/scenarios |
| `src/agents/defaults.ts` | DEFAULT_MODEL, DEFAULT_PROVIDER, DEFAULT_CONTEXT_TOKENS |

### Tier 3 — Heartbeat & Scheduling
| File | What it controls |
|---|---|
| `src/infra/heartbeat-runner.ts` | Periodic agent wake-ups and task timing |
| `src/auto-reply/heartbeat.ts` | Heartbeat prompt templates |
| `src/cron/heartbeat-policy.ts` | Scheduling policy config |
| `src/cron/service.ts` | Cron job abstraction |

### Tier 4 — Config Schemas
| File | What it controls |
|---|---|
| `src/config/zod-schema.agent-defaults.ts` | Validated agent default behavior |
| `src/config/zod-schema.agent-runtime.ts` | Runtime mode (embedded vs ACP) |
| `src/config/defaults.ts` | Model aliases, concurrency limits |

### Tier 5 — Tools & Skills
| File | What it controls |
|---|---|
| `src/agents/pi-tools.ts` | Tool definitions and policy |
| `src/agents/tool-policy.ts` | Tool execution restrictions |
| `src/agents/skills.ts` | Skill loading and init |
| `skills/` directory | Individual skill manifests (SKILL.md files) |

---

## Highest-Leverage Files for Soul/Personality Changes

- **`src/agents/system-prompt.ts`** — where personality, instructions, and identity get assembled before hitting the model
- **`src/agents/identity.ts`** — agent name, emoji, acknowledgment style, display preferences
