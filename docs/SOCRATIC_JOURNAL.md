# Socratic Journal

Questions explored during each step of building the AI coding agent. Each entry captures a concept we discussed, what was learned, and why it matters.

When answering a question, include **file paths and line references** where the concept is demonstrated in the codebase (e.g., `src/api/anthropic.ts:45-70`). This connects the theory to real code you can revisit.

Use this as a study guide to revisit key ideas.

---

## Step 1 - Core REPL and Streaming Chat Loop

> Step 1 was implemented before the Socratic process was established. These questions were identified retroactively as missed learning opportunities. We'll explore them properly going forward.

### Q1: Why build a REST client instead of using the Anthropic SDK?

**Why it matters:** The SDK abstracts away HTTP headers, SSE parsing, error codes, and streaming mechanics. Building it yourself means you understand exactly what's happening on the wire — which is essential when debugging agent behavior, optimizing token usage, or switching providers.

---

### Q2: What is SSE and why does Anthropic use it instead of WebSockets or plain JSON?

**Why it matters:** SSE is unidirectional (server → client), runs over plain HTTP, and is trivially parseable. WebSockets are bidirectional and more complex. Plain JSON requires waiting for the full response. Understanding this tradeoff explains why every major LLM provider chose SSE for streaming.

---

### Q3: What is an AsyncGenerator and when would you reach for one?

**Why it matters:** AsyncGenerators let you produce values on demand from an async source. They're the natural fit for "data arrives in chunks over time" — exactly what streaming APIs do. Understanding the progression from callbacks → promises → async iterators is a key JavaScript/TypeScript skill.

---

### Q4: Why does the full conversation history get sent with every API request?

**Why it matters:** LLMs are stateless. They have no memory between calls. This has direct implications for cost (tokens aren't free), latency (longer history = slower responses), and architecture (you'll need context management in Step 5).

---

### Q5: Why use `process.stdout.write()` instead of `console.log()` for streaming?

**Why it matters:** `console.log` appends `\n`. When rendering token-by-token, you'd get a newline after every chunk. `stdout.write` gives you raw control. Small detail, but it's the difference between a smooth streaming experience and garbage output.

---

### Q6: Why separate the API client from the REPL module?

**Why it matters:** Separation of concerns. The REPL handles user interaction. The API client handles HTTP. When we add tool calling in Step 2, the REPL loop changes significantly but the API client barely does. This is what "design for extension" looks like in practice.

---

### Q7: What happens when `rl.question()` is awaiting and you press Ctrl+C?

**What we learned:** Node's `readline/promises` rejects the pending promise with an `AbortError` before any SIGINT handler runs. If you register a competing `process.on("SIGINT")` handler, you get a race condition. The fix is to catch the `AbortError` from `rl.question()` directly instead of fighting readline's built-in behavior.

**See also:** `LESSONS_LEARNED.md` entry #1

---

## Step 2 - Tool Calling and `read_file`

### Q1: How should `Message.content` change to support tool calling?

**Why it matters:** The Anthropic API represents tool interactions as structured content blocks — `text`, `tool_use`, and `tool_result` — inside a `content` array. Our Step 1 type used `content: string`, which can't represent these. The design choice was: union type (`string | ContentBlock[]`) vs. always arrays.

**What we learned:** Always using `ContentBlock[]` is the right call. A union type means every piece of code that touches `content` needs a "is this a string or array?" branch. With uniform arrays, there's one shape everywhere — `{ type: "text", text: "hello" }` for simple messages, and the same array naturally extends to hold `tool_use` and `tool_result` blocks. It's slightly more verbose for plain text, but eliminates an entire class of conditional logic.

**Demonstrated in:** `src/api/anthropic.ts` — `TextBlock`, `ToolUseBlock`, `ToolResultBlock`, `ContentBlock` types and updated `Message` type (to be implemented).

---

### Q2: Why structure implementation bottom-up (types → plumbing → integration) instead of top-down?

**Why it matters:** Bottom-up lets each layer establish a concrete contract that the layer above depends on. Types define shapes → registry defines lookup → accumulator defines stream processing → agent loop orchestrates. Each piece is testable in isolation before wiring into the next layer.

**What we learned:** Bottom-up gives you a big picture view that you break into smaller, contractual pieces. Each layer fulfills a specific contract, and you build confidence incrementally: "types compile → registry tests pass → read_file tests pass → accumulator tests pass → agent loop tests pass → wire into REPL and it just works." Going top-down, you'd be writing the agent loop while the types it depends on don't exist — either guessing at shapes or constantly backtracking to fix foundations. It's like building a house: foundation, framing, walls, roof. Not the other way around.

**Demonstrated in:** `openspec/changes/tool-calling-read-file/tasks.md` — task groups ordered: (1) types, (2) registry, (3) read_file, (4) accumulator, (5) agent loop, (6) REPL integration, (7) manual testing.

---

## Step 3 - Editing and Codebase Search Tools

### Q1: When a Node.js built-in API requires a newer version, should you bump the minimum version or polyfill?

**Why it matters:** The `glob` and `grep` tools use `glob()` from `node:fs/promises`, which was added in Node 22. CI ran Node 20 and the tools silently failed — caught by error handlers, returning `{ isError: true }`. This is a real dependency management decision: do you use the platform's built-in API and accept a higher minimum version, or add a polyfill/package to support older runtimes?

**What we learned:** For a developer tool (not a library others install), bumping to Node 22 LTS was the right call. The tradeoffs:

1. **Bump Node version** — Zero dependencies added, uses battle-tested platform API, Node 22 has been LTS since October 2024. Downside: anyone on Node 20 can't run the tool. For a dev tool used by its author, this is a non-issue.
2. **Manual directory walker** — Works on Node 20, but you're writing and maintaining recursive filesystem traversal code that the platform already provides. More surface area for bugs (symlink loops, permission errors, path normalization).
3. **npm glob package** — Battle-tested, but adds a dependency for something the platform now provides natively. Dependencies have maintenance costs (updates, audits, supply chain risk).

The general principle: **prefer platform APIs over dependencies when you can control your runtime**. Libraries consumed by others need broader compatibility. Tools you control don't.

**Demonstrated in:**
- `src/tools/glob.ts:1` — `import { glob as fsGlob } from "node:fs/promises"` (the API that requires Node 22)
- `src/tools/grep.ts:2` — same import for directory traversal in grep
- `.github/workflows/ci.yml:18` — `node-version: 22` (the fix)
- `package.json:20-22` — `"engines": { "node": ">=22" }` (enforces the requirement)

