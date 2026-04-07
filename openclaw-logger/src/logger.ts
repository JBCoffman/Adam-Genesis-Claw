import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import type {
  LogEntry,
  PartialEntry,
  PendingMessage,
  HookMessageContext,
  HookAgentContext,
  HookMessageReceivedEvent,
  HookLlmInputEvent,
  HookLlmOutputEvent,
  HookAgentEndEvent,
  HookMessageSentEvent,
} from "./types.js";

const STALE_TTL_MS = 10 * 60 * 1000;
const CLEANUP_INTERVAL_MS = 60 * 1000;
const SYSTEM_PROMPT_PREVIEW_CHARS = 500;

export class Logger {
  private logDir: string;
  private disabled = false;

  /** In-flight runs keyed by `sessionId:runId`. */
  private runs = new Map<string, PartialEntry>();

  /**
   * Best-effort bridge: message_received fires with no sessionId.
   * We stash the latest inbound message per channelId and merge it
   * when llm_input fires (which does have sessionId + channelId).
   */
  private pendingMessages = new Map<string, PendingMessage>();

  /**
   * Best-effort bridge: message_sent fires with no sessionId.
   * We stash the latest delivered text per channelId and attach it
   * when agent_end fires.
   */
  private lastDelivered = new Map<string, string>();

  constructor(pluginConfig?: Record<string, unknown>) {
    // Read logDir from plugins.entries.openclaw-logger.config.logDir
    const rawDir =
      (pluginConfig?.["logDir"] as string | undefined) ??
      path.join(os.homedir(), ".openclaw", "logs", "conversations");
    this.logDir = rawDir.replace(/^~(?=$|\/)/, os.homedir());

    try {
      fs.mkdirSync(this.logDir, { recursive: true });
    } catch (err) {
      console.error("[openclaw-logger] Failed to create log directory:", this.logDir, err);
      this.disabled = true;
    }

    // Stale-entry TTL sweep — .unref() so this never prevents clean shutdown
    setInterval(() => this.cleanupStale(), CLEANUP_INTERVAL_MS).unref();
  }

  private runKey(sessionId: string, runId?: string | null): string {
    return runId ? `${sessionId}:${runId}` : sessionId;
  }

  // ---------------------------------------------------------------------------
  // Hook handlers
  // ---------------------------------------------------------------------------

  async onMessageReceived(event: HookMessageReceivedEvent, ctx: HookMessageContext): Promise<void> {
    const channelId = ctx.channelId ?? "unknown";
    this.pendingMessages.set(channelId, {
      content: event.content,
      from: event.from,
      conversationId: ctx.conversationId,
      channelId,
      timestamp: event.timestamp ?? Date.now(),
    });
  }

  async onLlmInput(event: HookLlmInputEvent, ctx: HookAgentContext): Promise<void> {
    const key = this.runKey(event.sessionId, event.runId);
    const existing = this.runs.get(key) ?? { _createdAt: Date.now() };

    const systemPromptText = event.systemPrompt ?? "";
    // Avoid concatenating potentially large strings just for character count
    const fullPromptCharCount = systemPromptText.length + (event.prompt?.length ?? 0);

    // Drain pending user message for this channel
    const channelId = ctx.channelId ?? null;
    let pending: PendingMessage | undefined;
    if (channelId) {
      pending = this.pendingMessages.get(channelId);
      this.pendingMessages.delete(channelId);
    }

    this.runs.set(key, {
      ...existing,
      session_id: event.sessionId,
      run_id: event.runId,
      session_key: ctx.sessionKey ?? null,
      agent_id: ctx.agentId ?? null,
      channel: channelId,
      model: event.model,
      provider: event.provider,
      system_prompt_preview: systemPromptText.slice(0, SYSTEM_PROMPT_PREVIEW_CHARS) || null,
      full_prompt_char_count: fullPromptCharCount,
      ...(pending != null && {
        user_message: pending.content,
        sender_id: pending.from,
        conversation_id: pending.conversationId ?? null,
      }),
    });
  }

  async onLlmOutput(event: HookLlmOutputEvent, _ctx: HookAgentContext): Promise<void> {
    const key = this.runKey(event.sessionId, event.runId);
    const existing = this.runs.get(key) ?? { _createdAt: Date.now() };

    const responseText = event.assistantTexts.length > 0 ? event.assistantTexts.join("\n") : null;
    const thinkingContent = extractThinkingContent(event.lastAssistant);

    const updated: PartialEntry = {
      ...existing,
      _llmOutputDone: true,
      response_text: responseText,
      thinking_content: thinkingContent,
      thinking_enabled: thinkingContent !== null,
      input_tokens: event.usage?.input ?? null,
      output_tokens: event.usage?.output ?? null,
      total_tokens: event.usage?.total ?? null,
    };
    this.runs.set(key, updated);

    // agent_end fires before llm_output in the gateway. If agent_end already
    // stored its finalize params, write the complete entry now.
    if (updated._agentEnded && updated._finalizeParams) {
      const entry = this.finalizeEntry(updated, updated._finalizeParams);
      this.write(entry);
      this.runs.delete(key);
    }
  }

  async onMessageSent(event: HookMessageSentEvent, ctx: HookMessageContext): Promise<void> {
    if (event.success && event.content) {
      const channelId = ctx.channelId ?? "unknown";
      this.lastDelivered.set(channelId, event.content);
    }
  }

  async onAgentEnd(event: HookAgentEndEvent, ctx: HookAgentContext): Promise<void> {
    const sessionId = ctx.sessionId;
    if (!sessionId) {
      return;
    }

    const key = this.runKey(sessionId, ctx.runId);
    const partial = this.runs.get(key);
    if (!partial) {
      return;
    }

    const channelId = ctx.channelId ?? partial.channel ?? null;
    const deliveredText = channelId ? (this.lastDelivered.get(channelId) ?? null) : null;
    if (channelId && deliveredText !== null) {
      this.lastDelivered.delete(channelId);
    }

    const finalizeParams = {
      runId: ctx.runId ?? partial.run_id ?? key,
      sessionId,
      agentId: ctx.agentId ?? partial.agent_id ?? null,
      channel: channelId,
      sessionKey: ctx.sessionKey ?? partial.session_key ?? null,
      latencyMs: event.durationMs ?? null,
      status: event.success ? "ok" : "error",
      error: event.error ?? null,
      deliveredText,
    };

    const updated: PartialEntry = {
      ...partial,
      _agentEnded: true,
      _finalizeParams: finalizeParams,
    };
    this.runs.set(key, updated);

    // llm_output fires after agent_end in the gateway. If llm_output already
    // completed (rare edge case), write now. Otherwise onLlmOutput will write.
    if (updated._llmOutputDone) {
      const entry = this.finalizeEntry(updated, finalizeParams);
      this.write(entry);
      this.runs.delete(key);
    }
    // If llm_output never fires (error/aborted runs), stale cleanup handles it.
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  private finalizeEntry(
    partial: PartialEntry,
    overrides: {
      runId: string;
      sessionId: string;
      agentId: string | null;
      channel: string | null;
      sessionKey: string | null;
      latencyMs: number | null;
      status: "ok" | "error";
      error: string | null;
      deliveredText: string | null;
    },
  ): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      run_id: overrides.runId,
      session_id: overrides.sessionId,
      session_key: overrides.sessionKey,
      agent_id: overrides.agentId,
      channel: overrides.channel,
      user_message: partial.user_message ?? null,
      sender_id: partial.sender_id ?? null,
      conversation_id: partial.conversation_id ?? null,
      model: partial.model ?? null,
      provider: partial.provider ?? null,
      system_prompt_preview: partial.system_prompt_preview ?? null,
      full_prompt_char_count: partial.full_prompt_char_count ?? null,
      thinking_enabled: partial.thinking_enabled ?? false,
      thinking_level: partial.thinking_level ?? null,
      response_text: partial.response_text ?? null,
      thinking_content: partial.thinking_content ?? null,
      input_tokens: partial.input_tokens ?? null,
      output_tokens: partial.output_tokens ?? null,
      total_tokens: partial.total_tokens ?? null,
      latency_ms: overrides.latencyMs,
      status: overrides.status,
      error: overrides.error,
      delivered_text: overrides.deliveredText,
    };
  }

  private write(entry: LogEntry): void {
    if (this.disabled) {
      return;
    }
    const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD UTC
    const filename = path.join(this.logDir, `openclaw-${date}.jsonl`);
    try {
      fs.appendFileSync(filename, JSON.stringify(entry) + "\n", "utf8");
    } catch (err) {
      console.error("[openclaw-logger] Failed to write log entry:", err);
    }
  }

  private cleanupStale(): void {
    const cutoff = Date.now() - STALE_TTL_MS;
    for (const [key, partial] of this.runs.entries()) {
      if (partial._createdAt < cutoff) {
        const fp = partial._finalizeParams;
        const entry = this.finalizeEntry(partial, {
          runId: fp?.runId ?? partial.run_id ?? key,
          sessionId: fp?.sessionId ?? partial.session_id ?? key,
          agentId: fp?.agentId ?? partial.agent_id ?? null,
          channel: fp?.channel ?? partial.channel ?? null,
          sessionKey: fp?.sessionKey ?? partial.session_key ?? null,
          latencyMs: fp?.latencyMs ?? null,
          status: "error",
          error: fp ? "llm_output_not_received" : "run_did_not_complete",
          deliveredText: fp?.deliveredText ?? partial.delivered_text ?? null,
        });
        this.write(entry);
        this.runs.delete(key);
      }
    }
  }
}

/**
 * Extracts thinking/reasoning text from the lastAssistant message object.
 * Handles Anthropic-style content block arrays: [{ type: "thinking", thinking: "..." }, ...]
 */
function extractThinkingContent(lastAssistant: unknown): string | null {
  if (!lastAssistant || typeof lastAssistant !== "object") {
    return null;
  }
  const msg = lastAssistant as Record<string, unknown>;
  const content = msg["content"];
  if (!Array.isArray(content)) {
    return null;
  }
  for (const block of content) {
    if (typeof block === "object" && block !== null) {
      const b = block as Record<string, unknown>;
      if (b["type"] === "thinking" && typeof b["thinking"] === "string") {
        return b["thinking"];
      }
    }
  }
  return null;
}
