# Socratic Journal

Questions explored during each step of building the AI coding agent. Each entry captures a concept we discussed, what was learned, and why it matters.

Use this as a study guide to revisit key ideas.

---

## Step 1 - Core REPL and Streaming Chat Loop

> Step 1 was implemented before the Socratic process was established. These questions were identified retroactively as missed learning opportunities. We'll explore them properly going forward.

### Q1: Why build a REST client instead of using the Anthropic SDK?

**Status:** Not yet explored

**Why it matters:** The SDK abstracts away HTTP headers, SSE parsing, error codes, and streaming mechanics. Building it yourself means you understand exactly what's happening on the wire — which is essential when debugging agent behavior, optimizing token usage, or switching providers.

---

### Q2: What is SSE and why does Anthropic use it instead of WebSockets or plain JSON?

**Status:** Not yet explored

**Why it matters:** SSE is unidirectional (server → client), runs over plain HTTP, and is trivially parseable. WebSockets are bidirectional and more complex. Plain JSON requires waiting for the full response. Understanding this tradeoff explains why every major LLM provider chose SSE for streaming.

---

### Q3: What is an AsyncGenerator and when would you reach for one?

**Status:** Not yet explored

**Why it matters:** AsyncGenerators let you produce values on demand from an async source. They're the natural fit for "data arrives in chunks over time" — exactly what streaming APIs do. Understanding the progression from callbacks → promises → async iterators is a key JavaScript/TypeScript skill.

---

### Q4: Why does the full conversation history get sent with every API request?

**Status:** Not yet explored

**Why it matters:** LLMs are stateless. They have no memory between calls. This has direct implications for cost (tokens aren't free), latency (longer history = slower responses), and architecture (you'll need context management in Step 5).

---

### Q5: Why use `process.stdout.write()` instead of `console.log()` for streaming?

**Status:** Not yet explored

**Why it matters:** `console.log` appends `\n`. When rendering token-by-token, you'd get a newline after every chunk. `stdout.write` gives you raw control. Small detail, but it's the difference between a smooth streaming experience and garbage output.

---

### Q6: Why separate the API client from the REPL module?

**Status:** Not yet explored

**Why it matters:** Separation of concerns. The REPL handles user interaction. The API client handles HTTP. When we add tool calling in Step 2, the REPL loop changes significantly but the API client barely does. This is what "design for extension" looks like in practice.

---

### Q7: What happens when `rl.question()` is awaiting and you press Ctrl+C?

**Status:** Explored (via bug)

**What we learned:** Node's `readline/promises` rejects the pending promise with an `AbortError` before any SIGINT handler runs. If you register a competing `process.on("SIGINT")` handler, you get a race condition. The fix is to catch the `AbortError` from `rl.question()` directly instead of fighting readline's built-in behavior.

**See also:** `LESSONS_LEARNED.md` entry #1