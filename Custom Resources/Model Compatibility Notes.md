# Model Compatibility Notes

Known model-specific quirks and the workarounds applied to AdamClaw. When switching models, check this file to understand which customizations are load-bearing vs. safe to remove.

---

## Gemini 2.5 Flash Lite (`google/gemini-2.5-flash-lite`)

### Inline `<think>` tag output

**Problem:** Even with API-level thinking enabled (`thinkingDefault: low`), Gemini outputs `<think>...</think>` tags directly in its response text as a way of showing reasoning. The OpenClaw gateway uses `<final>` tags to extract the deliverable content for channel delivery (Telegram, etc.). Inline `<think>` tags corrupt this parsing — the response is generated but never delivered.

**Symptoms:**

- Agent run shows `output_tokens > 0`, `status: ok`, but `response_text: null` in conversation logs
- Response visible in gateway web UI chat history but not received in Telegram
- Session file shows assistant message starting with `<think>` instead of `<final>`

**Workaround applied:** Added explicit instruction to `AGENTS.md`:

> Never put `<think>` or `</think>` tags in response text. Reasoning happens through the built-in thinking mechanism.

**Where it lives:** `agent-configs/adamclaw/workspace/AGENTS.md` → "Response Format — Gemini-Specific Workaround" section.

**If switching models:** This rule is safe to remove from `AGENTS.md`. Claude, GPT-4o, and most local LLMs do not exhibit this behavior — they either use proper API thinking fields or output clean text without inline reasoning tags.

---

## Future: Local LLM on Network Device

Jake's roadmap includes routing AdamClaw's thinking to a self-hosted local LLM (e.g., via Ollama on a network device). When that happens:

- Remove the Gemini `<think>` tag workaround from `AGENTS.md` if the local model doesn't need it
- Test delivery end-to-end after any model switch before declaring it stable
- Add a new section here documenting any quirks specific to the local model

The `thinkingDefault` config key in `openclaw.json` controls thinking level per-agent and is model-agnostic — it will carry over to whatever model AdamClaw runs on.
