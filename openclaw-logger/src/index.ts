import { definePluginEntry } from "openclaw/plugin-sdk/core";
import type { OpenClawPluginApi } from "openclaw/plugin-sdk/core";
import { Logger } from "./logger.js";

export default definePluginEntry({
  id: "openclaw-logger",
  name: "Conversation Logger",
  description:
    "Logs all LLM conversations (input, output, thinking, tokens, latency) to JSONL files on disk.",
  register(api: OpenClawPluginApi) {
    // Instantiate inside register() so api.pluginConfig is available
    const logger = new Logger(api.pluginConfig);

    api.on("message_received", async (event, ctx) => {
      try {
        await logger.onMessageReceived(event, ctx);
      } catch (e) {
        console.error("[openclaw-logger] message_received error:", e);
      }
    });

    api.on("llm_input", async (event, ctx) => {
      try {
        await logger.onLlmInput(event, ctx);
      } catch (e) {
        console.error("[openclaw-logger] llm_input error:", e);
      }
    });

    api.on("llm_output", async (event, ctx) => {
      try {
        await logger.onLlmOutput(event, ctx);
      } catch (e) {
        console.error("[openclaw-logger] llm_output error:", e);
      }
    });

    api.on("message_sent", async (event, ctx) => {
      try {
        await logger.onMessageSent(event, ctx);
      } catch (e) {
        console.error("[openclaw-logger] message_sent error:", e);
      }
    });

    // agent_end fires last — triggers the write
    api.on("agent_end", async (event, ctx) => {
      try {
        await logger.onAgentEnd(event, ctx);
      } catch (e) {
        console.error("[openclaw-logger] agent_end error:", e);
      }
    });
  },
});
