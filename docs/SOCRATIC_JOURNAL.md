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

---

## Step 4 - Bash Tool and Permissions

### Q1: Why use `execFile("/bin/sh", ["-c", command])` instead of `exec(command)` or `spawn()`?

**Why it matters:** Node.js has three main ways to run shell commands: `exec`, `execFile`, and `spawn`. They look similar but have different tradeoffs around buffering, shell invocation, and API ergonomics. Choosing the wrong one leads to subtle bugs — truncated output, missing shell features, or unnecessary complexity.

**What we learned:** The three options break down like this:

1. **`exec(command)`** — Spawns a shell implicitly, buffers stdout/stderr into strings, and returns them via callback. Simple API, but has a default `maxBuffer` of 1MB. If a command produces more output than that, it silently truncates. The implicit shell invocation also makes the contract less explicit.

2. **`execFile("/bin/sh", ["-c", command])`** — Also buffers output, but you explicitly control the shell binary and arguments. Same convenience as `exec` (you get complete stdout/stderr strings after the process exits), but the explicit shell invocation makes it clear what's happening. It's also easier to extend later — adding `timeout`, `cwd`, or `env` options is a clean addition to the options object.

3. **`spawn(command)`** — Returns streams for stdout/stderr instead of buffering. You manually collect chunks and assemble the final output. This is the right choice when you need to process output incrementally (like piping to another process or streaming to a UI), but for our use case — wait for completion, return the full result — it adds complexity for no benefit.

The key insight: **match the abstraction to the consumption pattern**. We consume the full result after completion (not incrementally), so buffered output is the right model. `execFile` gives us that with an explicit shell contract.

**Demonstrated in:**
- `src/tools/bash.ts:1-4` — `execFile` import and `promisify` wrapper
- `src/tools/bash.ts:24` — the actual `execFileAsync("/bin/sh", ["-c", command])` call

---

### Q2: Where should permission checks live — in each tool, in the agent loop, or in middleware?

**Why it matters:** Permissions are a cross-cutting concern that touches every tool call. Where you place the check determines how much code duplication you create, how testable the system is, and how easy it is to change the permission model later.

**What we learned:** There are three natural places to put the check:

1. **Inside each tool's `execute` function** — Every tool checks its own permission before running. This distributes the logic across 6+ files, requires every new tool author to remember to add the check, and mixes two concerns (permission policy and tool behavior) in the same function. If the permission model changes, you edit every tool.

2. **In the agent loop, before calling `execute`** — One location, one check, applied uniformly to all tools. The tool executors stay pure — they only know how to do their job, not who's allowed to call them. New tools automatically get permission enforcement with zero extra code.

3. **In a middleware wrapper** — Wrap each tool's `execute` function at registration time with a permission-checking decorator. This is elegant in theory but adds indirection — when debugging, you're stepping through wrapper functions. At our scale (6 tools), the abstraction cost exceeds the benefit.

We chose option 2. The agent loop already handles tool lookup, error handling, and result formatting — adding permission checks is a natural extension of its orchestration role. The permission mode lives on the `ToolRegistration` (co-located with tool metadata), but the enforcement logic lives in the loop (co-located with execution).

**Demonstrated in:**
- `src/tools/index.ts:12` — `ToolPermission` type and `permission` field on `ToolRegistration`
- `src/agent.ts:128-168` — permission check branching in the tool execution loop (deny → reject, prompt → callback, allow → execute)

---

### Q3: Why use a callback (`promptForApproval`) instead of importing readline directly into the agent loop?

**Why it matters:** The agent loop needs to ask the user a yes/no question for `prompt`-mode tools. The most direct approach — importing `readline` and asking directly — would work, but it creates a coupling that has consequences for testing and reuse.

**What we learned:** This is a dependency inversion decision. The agent loop is a core orchestration module. If it imports `readline` directly:

- **Testing becomes hard** — Unit tests for the agent loop would need to mock `readline`, simulate stdin, or run in a TTY environment. Every test that exercises the tool-calling path now has an I/O dependency.
- **Reuse breaks** — If we later add a headless/scripted mode (Step "Going Further"), the agent loop can't prompt a terminal that doesn't exist. We'd need to refactor the loop to support both modes.
- **Separation of concerns erodes** — The loop's job is "orchestrate model ↔ tools." User interaction is the REPL's job.

The callback pattern (`promptForApproval?: (...) => Promise<boolean>`) inverts the dependency. The agent loop declares what it needs ("ask the user and give me a boolean"), and the caller provides the implementation. The REPL passes a function that uses `readline`. Tests pass a stub that returns `true` or `false`. A future headless mode passes one that auto-approves based on a policy.

This is the same pattern as `write: (text: string) => void` that the loop already uses for output — we're just extending it to input.

**Demonstrated in:**
- `src/agent.ts:93-96` — `promptForApproval` as optional callback in `AgentLoopOptions`
- `src/repl.ts:28-38` — `createPromptForApproval(rl)` factory that captures the readline instance
- `src/repl.ts:72` — passing the callback to `runAgentLoop`
- `src/__tests__/agent.test.ts` — tests use `vi.fn().mockResolvedValue(true/false)` as the callback

---

### Q4: Why return a `ToolResult` with `isError: true` for denied tools instead of throwing or using a special result type?

**Why it matters:** When a tool call is denied, the system needs to communicate this to the model so it can adapt. The choice of how to represent denial determines whether the model can handle it naturally or whether you need special-case handling throughout the codebase.

**What we learned:** There were three options:

1. **Throw an exception** — The agent loop's existing `catch` block would handle it, but exceptions are for unexpected failures, not expected control flow. A denied tool call is a normal event, not an error in the system. Using exceptions for flow control also makes the code harder to reason about — any `await` could throw for a "normal" reason.

2. **New result type (e.g., `ToolDenialResult`)** — Clean semantically, but requires updating every place that handles tool results: the agent loop, the message history format, the API types, and any future consumers. It also requires the model to understand a new result shape (it won't — the Anthropic API only has `tool_result` with `is_error`).

3. **`ToolResult` with `isError: true` and a descriptive message** — Uses the existing error path. The model already knows how to interpret `is_error: true` results — it treats them as failures and adjusts its approach (tries a different tool, asks the user, or explains what happened). No new types, no new handling code, and the model "just works."

We chose option 3. The key insight: **from the model's perspective, a denied tool call and a failed tool call are functionally identical** — in both cases, the tool didn't do the requested work and the model needs to adapt. Reusing the error channel means zero new infrastructure and the model handles it naturally.

**Demonstrated in:**
- `src/agent.ts:138-141` — deny-mode denial result
- `src/agent.ts:157-160` — user-declined denial result
- `src/__tests__/agent.test.ts` — tests verify denial results have `is_error: true` and include the tool name

