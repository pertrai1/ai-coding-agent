## Context

The agent currently has a simple REPL loop (`src/repl.ts`) that sends user text to the Anthropic Messages API via a streaming HTTP client (`src/api/anthropic.ts`), renders text deltas to stdout, and stores conversation history as `Message[]` where `Message = { role: "user" | "assistant"; content: string }`.

Step 2 transforms this chat loop into an **agent loop** — one that can call tools, observe results, and continue reasoning. This is the foundational plumbing that every subsequent step (editing, bash, search, permissions) builds on. The Anthropic API already supports tool calling natively: we send tool definitions in the request, the model emits `tool_use` content blocks when it wants to call a tool, and we send results back as `tool_result` content blocks.

Current files involved:
- `src/api/anthropic.ts` — Types (`Message`, `StreamEvent` union), `createMessageStream()`, `parseSSEStream()`, `streamMessage()`
- `src/repl.ts` — REPL loop, conversation history, streaming consumption
- `src/__tests__/repl.test.ts` and `src/__tests__/anthropic.test.ts` — existing test suites

## Goals / Non-Goals

**Goals:**
- Extend the type system to support content block arrays (text, tool_use, tool_result) — the uniform message format
- Parse tool_use content blocks from the streaming response, including accumulating `input_json_delta` partial JSON
- Build a tool registry that maps names to definitions + executors
- Implement the agent loop: stream → detect tool_use → execute → append result → re-stream → until end_turn
- Implement the `read_file` tool with structured error handling
- Keep existing text-only chat working identically (no regression)

**Non-Goals:**
- Tool permissions / approval prompts (Step 4)
- Mutating tools like `edit_file`, `write_file` (Step 3)
- Parallel tool execution (single sequential execution is sufficient for now)
- Token tracking per tool call (Step 5)
- Tool timeout or cancellation mechanisms
- File size limits or binary file detection for `read_file`

## Decisions

### 1. Message content is always `ContentBlock[]`

**Decision**: Change `Message.content` from `string` to `ContentBlock[]` where `ContentBlock = TextBlock | ToolUseBlock | ToolResultBlock`. Every message uses the array form — user text becomes `[{ type: "text", text: "..." }]`.

**Alternatives considered**:
- **Union type `string | ContentBlock[]`**: Requires branching logic everywhere content is accessed. More code, more bugs.
- **Always arrays** (chosen): One shape everywhere. Matches the Anthropic API's native format. No conditional content handling. Slightly more verbose for simple text, but the consistency pays off immediately.

**Impact**: All code constructing or reading `Message` objects changes. Tests that use `content: "text"` must update to `content: [{ type: "text", text: "text" }]`. The `createMessageStream` function already sends `messages` directly to the API, so this aligns with what Anthropic expects.

### 2. Stream accumulator collects content blocks

**Decision**: Introduce a stream accumulator that builds an array of `ContentBlock` objects as events arrive, rather than concatenating a single `assistantText` string.

The accumulator handles:
- `content_block_start` with `type: "text"` → push a new `TextBlock`, stream text to stdout
- `content_block_delta` with `type: "text_delta"` → append to current `TextBlock.text`, write to stdout
- `content_block_start` with `type: "tool_use"` → push a new `ToolUseBlock` (id, name, input starts empty)
- `content_block_delta` with `type: "input_json_delta"` → concatenate `partial_json` into a buffer
- `content_block_stop` → if current block is tool_use, `JSON.parse` the accumulated JSON into `input`

After the stream completes, the accumulator provides the full `ContentBlock[]` for the assistant message plus the `stop_reason` from `message_delta`.

**Why not parse tool calls from text?**: The Anthropic API provides structured tool_use blocks — parsing from freeform text would be fragile, model-dependent, and unnecessary.

### 3. Agent loop replaces single-stream consumption

**Decision**: Extract the core stream-consume-display logic from the REPL into a separate `runAgentLoop` function (or equivalent) that:

1. Calls `streamMessage()` with current messages + tool definitions
2. Accumulates content blocks via the stream accumulator
3. Appends the assistant message (with all content blocks) to history
4. Checks `stop_reason`:
   - `"end_turn"` → done, return
   - `"tool_use"` → execute tools, append results, goto 1
5. Enforces an iteration limit (e.g., 10) to prevent infinite loops

The REPL's `while(true)` loop remains — it handles user input, then calls the agent loop for each turn, then waits for the next input.

**Alternatives considered**:
- **Inline the loop in the REPL**: Makes the already-long REPL function even harder to test. Extracting it allows unit testing the agent loop independently.
- **Recursive calls**: Less clear than an explicit loop. No benefit.

### 4. Tool registry as a simple Map

**Decision**: The tool registry is a `Map<string, ToolRegistration>` where `ToolRegistration` contains the Anthropic-format definition and an executor function. A module at `src/tools/index.ts` exports:
- `ToolDefinition` type (name, description, input_schema for the API)
- `ToolResult` type ({ content: string, isError?: boolean })
- `ToolRegistration` type (definition + execute function)
- `createToolRegistry()` function that returns a registry with `get(name)`, `getDefinitions()`, and `register(tool)` methods
- Pre-registers `read_file`

**Alternatives considered**:
- **Class-based registry**: Adds complexity with no benefit for a simple map lookup.
- **Global singleton**: Harder to test. Factory function allows fresh registries in tests.

### 5. Tool executor contract

**Decision**: Each tool executor is an async function: `(input: Record<string, unknown>) => Promise<ToolResult>`. Tools MUST NOT throw — they return `{ content: string, isError: true }` for failures. This keeps the agent loop simple: it never needs try/catch around tool execution.

The agent loop still wraps execution in try/catch as a safety net, but well-behaved tools handle their own errors.

### 6. File layout

```
src/
  api/
    anthropic.ts          ← Modified: new content block types, tools param, extended stream events
  tools/
    index.ts              ← New: ToolDefinition, ToolResult, ToolRegistration types, createToolRegistry()
    read-file.ts          ← New: read_file tool implementation
  repl.ts                 ← Modified: agent loop, content block accumulation, tool execution
  cli.ts                  ← Unchanged
  __tests__/
    tools.test.ts         ← New: tool registry and read_file tests
    repl.test.ts          ← Modified: update Message construction, add agent loop tests
    anthropic.test.ts     ← Modified: update Message construction, add tool_use stream event tests
```

### 7. Streaming event type extensions

**Decision**: Extend the existing `ContentBlockStartEvent` and `ContentBlockDeltaEvent` types with union members for tool_use blocks and input_json_delta. Add an `InputJSONDelta` type to the delta union in `ContentBlockDeltaEvent`.

```
ContentBlockStartEvent.content_block:
  | { type: "text", text: string }
  | { type: "tool_use", id: string, name: string, input: {} }

ContentBlockDeltaEvent.delta:
  | { type: "text_delta", text: string }
  | { type: "input_json_delta", partial_json: string }
```

This is purely additive — existing code that checks `delta.type === "text_delta"` continues to work via type narrowing.

## Risks / Trade-offs

**`input_json_delta` parsing relies on concatenation** → The Anthropic API streams tool input as partial JSON chunks. We concatenate them and `JSON.parse` at `content_block_stop`. If the model produces invalid JSON fragments, parsing fails. **Mitigation**: Wrap `JSON.parse` in try/catch; produce an error ToolResult if parsing fails, letting the model retry or explain.

**`Message.content` change is a breaking internal change** → Every test and code path that constructs or reads messages must update. **Mitigation**: This is an internal type, not a public API. The change is mechanical (string → array with one TextBlock). Do it atomically with the test updates so nothing is half-migrated.

**Agent loop iteration limit is arbitrary** → Setting it too low prevents complex multi-file reads; too high wastes tokens on broken loops. **Mitigation**: Start with 10 iterations (sufficient for reading ~10 files). Make it a constant that's easy to adjust later.

**No validation of `filePath` against project root** → `read_file` reads any path the model requests, including files outside the project. **Mitigation**: This is intentional for Step 2 — Step 4 adds the permission system. For now, `read_file` is a read-only tool with limited risk. Document this as a known gap.

## Open Questions

- **Should text output print a newline between the "thinking" text and the final answer after tool use?** The model often emits text like "Let me read that file..." before the tool call, then more text after. We need a clean visual separator. Likely a simple `\n` after tool execution is sufficient, but worth verifying in manual testing.
