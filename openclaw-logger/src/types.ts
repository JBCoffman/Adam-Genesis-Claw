// ---------------------------------------------------------------------------
// Hook event and context shapes
// Mirrored from src/plugins/types.ts — these are not re-exported by the SDK.
// Verified against: PluginHookMessageReceivedEvent, PluginHookLlmInputEvent,
// PluginHookLlmOutputEvent, PluginHookAgentEndEvent, PluginHookMessageSentEvent,
// PluginHookMessageContext, PluginHookAgentContext in openclaw/src/plugins/types.ts
// ---------------------------------------------------------------------------

export interface HookMessageContext {
  channelId: string;
  accountId?: string;
  conversationId?: string;
}

export interface HookAgentContext {
  runId?: string;
  agentId?: string;
  sessionKey?: string;
  sessionId?: string;
  workspaceDir?: string;
  messageProvider?: string;
  trigger?: string;
  channelId?: string;
}

export interface HookMessageReceivedEvent {
  from: string;
  content: string;
  timestamp?: number;
  metadata?: Record<string, unknown>;
}

export interface HookLlmInputEvent {
  runId: string;
  sessionId: string;
  provider: string;
  model: string;
  systemPrompt?: string;
  prompt: string;
  historyMessages: unknown[];
  imagesCount: number;
}

export interface HookLlmOutputEvent {
  runId: string;
  sessionId: string;
  provider: string;
  model: string;
  assistantTexts: string[];
  lastAssistant?: unknown;
  usage?: {
    input?: number;
    output?: number;
    cacheRead?: number;
    cacheWrite?: number;
    total?: number;
  };
}

export interface HookAgentEndEvent {
  messages: unknown[];
  success: boolean;
  error?: string;
  durationMs?: number;
}

export interface HookMessageSentEvent {
  to: string;
  content: string;
  success: boolean;
  error?: string;
}

// ---------------------------------------------------------------------------
// Log entry schema
// ---------------------------------------------------------------------------

export interface LogEntry {
  // Identity
  timestamp: string;
  run_id: string;
  session_id: string;
  session_key: string | null;
  agent_id: string | null;
  channel: string | null;

  // Request
  user_message: string | null;
  sender_id: string | null;
  conversation_id: string | null;

  // LLM Input
  model: string | null;
  provider: string | null;
  system_prompt_preview: string | null;
  full_prompt_char_count: number | null;
  thinking_enabled: boolean;
  thinking_level: string | null;

  // LLM Output
  response_text: string | null;
  thinking_content: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  total_tokens: number | null;

  // Run metadata
  latency_ms: number | null;
  status: "ok" | "error";
  error: string | null;

  // Delivery
  delivered_text: string | null;
}

/** Internal partial entry built up as hook events arrive. Never written to disk directly. */
export interface PartialEntry {
  _createdAt: number;
  /** Set when agent_end fires; triggers write once llm_output also fires. */
  _agentEnded?: boolean;
  /** Set when llm_output fires; triggers write once agent_end also fires. */
  _llmOutputDone?: boolean;
  /** Finalize params cached from agent_end so write can happen in onLlmOutput. */
  _finalizeParams?: {
    runId: string;
    sessionId: string;
    agentId: string | null;
    channel: string | null;
    sessionKey: string | null;
    latencyMs: number | null;
    status: "ok" | "error";
    error: string | null;
    deliveredText: string | null;
  };
  run_id?: string;
  session_id?: string;
  session_key?: string | null;
  agent_id?: string | null;
  channel?: string | null;
  user_message?: string | null;
  sender_id?: string | null;
  conversation_id?: string | null;
  model?: string | null;
  provider?: string | null;
  system_prompt_preview?: string | null;
  full_prompt_char_count?: number | null;
  thinking_enabled?: boolean;
  thinking_level?: string | null;
  response_text?: string | null;
  thinking_content?: string | null;
  input_tokens?: number | null;
  output_tokens?: number | null;
  total_tokens?: number | null;
  delivered_text?: string | null;
}

/** Buffered inbound message awaiting correlation with an LLM run. */
export interface PendingMessage {
  content: string;
  from: string;
  conversationId: string | undefined;
  channelId: string;
  timestamp: number;
}
