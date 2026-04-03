# OpenClaw Token Optimization: First Principles Specification

## 1. Tool Schema Minimization (Input Tokens)
* **Abolish Natural Language Descriptions:** Replace verbose "description" fields in JSON schemas with dense, technical keywords. 
    * *Bad:* "Use this tool to search through the vector database to find relevant documents about our internal API."
    * *Good:* "Semantic search over API docs. Returns top_k chunks."
* **Enforced Enums:** Wherever possible, use `enum` fields instead of `string`. This limits the model's output entropy and prevents "guessing" which reduces retries.
* **No Redundant Metadata:** Strip `title` and `description` from nested properties if the parent key is self-explanatory (e.g., `user_id` needs no description).

## 2. Context State Management (The "Rolling Window")
* **Summary Injection:** Implement a trigger where, after 5 tool-turns, the last 4 turns are sent to a cheap model (GPT-4o-mini/Haiku) to be condensed into a single 100-token "State Summary" block.
* **Log Purging:** When a tool returns a success/fail message, keep the *result* but delete the raw *standard output* from the history if it exceeds 500 tokens. 
* **System Prompt Hardcoding:** If using a provider that supports "System Caching" (like Anthropic or DeepSeek), ensure the static system instructions are formatted to hit the cache, reducing repetitive input costs by ~90%.

## 3. Retrieval Architecture (The "Snippeting" Rule)
* **Line-Level Addressing:** Tools like `read_file` must support `start_line` and `end_line` parameters. The agent should be penalized (via system prompt) for reading more than 100 lines at once.
* **Projection Over Raw JSON:** Middleware must strip external API responses (GitHub, Jira, etc.) of all non-essential keys before they hit the context window. 
* **RAG Top-K Tuning:** Set default retrieval to `k=3`. Only allow the agent to request "more results" via a specific tool call if the first 3 were insufficient.

## 4. Execution Guardrails (The "Burn" Prevention)
* **Iteration Caps:** Hard-set `max_steps=10`. If the task isn't solved, the agent MUST return its current state and wait for a user "Continue" signal.
* **Stop Sequences:** Use strict stop sequences (e.g., `Observation:`) to prevent the LLM from "hallucinating" the tool's output before the tool actually runs.
* **Temperature Calibration:** Set `temperature=0.0` for all tool-calling turns. Deterministic outputs reduce the chance of expensive loops caused by creative "drifting."