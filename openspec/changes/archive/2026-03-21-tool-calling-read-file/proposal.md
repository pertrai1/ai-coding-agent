## Why

The agent currently has a chat-only loop — it can converse but can't interact with the filesystem or any external tools. Step 2 of the roadmap introduces tool calling, which is the foundational capability that transforms a chatbot into a coding agent. Without it, every subsequent step (editing, bash, search) has no mechanism to plug into. We need this now because it's the prerequisite for all useful agent behavior.

## What Changes

- Extend the `Message` type from `content: string` to `content: ContentBlock[]` so every message uses a uniform array-of-blocks shape — text blocks, tool_use blocks, and tool_result blocks all fit the same structure.
- Extend Anthropic streaming event types to handle `tool_use` content blocks and `input_json_delta` deltas (the API already emits these; our types just don't cover them yet).
- Add a `tools` parameter to the API request body so tool definitions are sent to the model.
- Build a tool registry that holds tool definitions (name, description, JSON input schema) and their executor functions.
- Implement a `read_file` tool that reads file contents from disk given a file path, returning structured errors for missing/unreadable files.
- Refactor the REPL loop from a single-shot stream-and-display into an **agent loop**: stream the response → detect `stop_reason: "tool_use"` → execute tool calls → append results → re-stream until the model produces a final text response (`stop_reason: "end_turn"`).

## Capabilities

### New Capabilities

- `tool-calling`: The agent loop that detects tool_use responses, executes registered tools, appends tool_result messages, and loops until the model produces a final text answer. Includes the tool registry, tool definition schema, and content block types.
- `read-file-tool`: The `read_file` tool implementation — reads a file path from disk and returns its text content, or a structured error if the file doesn't exist or can't be read.

### Modified Capabilities

_(none — no existing spec-level behavior is changing, only internal types are being extended to support the new capabilities)_

## Impact

- **`src/api/anthropic.ts`**: `Message` type changes from `content: string` to `content: ContentBlock[]`. New types for `ToolUseBlock`, `ToolResultBlock`, `TextBlock`, `InputJSONDeltaEvent`. `ContentBlockStartEvent` extended to handle `tool_use` blocks. `createMessageStream` extended to accept a `tools` parameter. All existing tests that construct `Message` objects will need updating.
- **`src/repl.ts`**: REPL loop refactored from single-stream to agent loop. Message construction changes from `{ role: "user", content: "text" }` to `{ role: "user", content: [{ type: "text", text: "text" }] }`. System prompt updated to mention available tools.
- **New `src/tools/` directory**: Tool registry (`index.ts`) and `read_file.ts` implementation.
- **Tests**: Existing tests in `src/__tests__/repl.test.ts` and `src/__tests__/anthropic.test.ts` will need updating for the new `Message` shape and new streaming event types. New tests for tool execution and the agent loop.
- **No new dependencies** — `node:fs/promises` is a built-in.
