## 1. Content Block Types and Message Format

- [x] 1.1 Add `TextBlock`, `ToolUseBlock`, `ToolResultBlock`, and `ContentBlock` union type to `src/api/anthropic.ts`
- [x] 1.2 Change `Message.content` from `string` to `ContentBlock[]` in `src/api/anthropic.ts`
- [x] 1.3 Extend `ContentBlockStartEvent.content_block` to union `{ type: "text" }` and `{ type: "tool_use", id, name, input }`
- [x] 1.4 Extend `ContentBlockDeltaEvent.delta` to union `{ type: "text_delta" }` and `{ type: "input_json_delta", partial_json: string }`
- [x] 1.5 Add optional `tools` parameter (array of `ToolDefinition`) to `CreateMessageStreamOptions` and include it in the request body when present
- [x] 1.6 Update all existing `Message` construction in `src/repl.ts` to use `ContentBlock[]` format (user messages and assistant messages)
- [x] 1.7 Update all existing `Message` construction in `src/__tests__/repl.test.ts` to use `ContentBlock[]` format
- [x] 1.8 Update all existing `Message` construction in `src/__tests__/anthropic.test.ts` to use `ContentBlock[]` format
- [x] 1.9 Run `npm run typecheck` and `npm test` to verify zero regressions from the type migration

## 2. Tool Registry

- [x] 2.1 Create `src/tools/index.ts` with `ToolDefinition`, `ToolResult`, `ToolRegistration` types and `ToolExecutor` function signature `(input: Record<string, unknown>) => Promise<ToolResult>`
- [x] 2.2 Implement `createToolRegistry()` factory returning an object with `register(tool)`, `get(name)`, and `getDefinitions()` methods backed by a `Map`
- [x] 2.3 Add unit tests in `src/__tests__/tools.test.ts` for registry: register a tool, look it up by name, query an unregistered name returns `undefined`, `getDefinitions()` returns all registered tools in Anthropic API format

## 3. `read_file` Tool

- [x] 3.1 Create `src/tools/read-file.ts` exporting the `read_file` tool registration (definition + executor) using `node:fs/promises`
- [x] 3.2 Implement the executor: read file at `filePath`, return `{ content: fileText }` on success
- [x] 3.3 Handle missing file: catch `ENOENT` and return `{ content: "...", isError: true }` with file path in message
- [x] 3.4 Handle permission denied: catch `EACCES` and return `{ content: "...", isError: true }` with description
- [x] 3.5 Handle directory path: catch `EISDIR` and return `{ content: "...", isError: true }` indicating path is a directory
- [x] 3.6 Handle empty file: return `{ content: "" }` (not an error)
- [x] 3.7 Add unit tests in `src/__tests__/tools.test.ts`: read existing file, read multi-line file preserving whitespace, read non-existent file returns `isError`, read empty file returns empty string, read directory returns `isError`
- [x] 3.8 Register `read_file` in the default registry created by `createToolRegistry()`

## 4. Stream Accumulator

- [x] 4.1 Implement a stream accumulator function/object that processes `StreamEvent` objects and builds a `ContentBlock[]` array plus captures `stop_reason`
- [x] 4.2 Handle `content_block_start` with `type: "text"`: push new `TextBlock`
- [x] 4.3 Handle `content_block_delta` with `type: "text_delta"`: append text to current block, write to stdout
- [x] 4.4 Handle `content_block_start` with `type: "tool_use"`: push new `ToolUseBlock` with id, name, empty input
- [x] 4.5 Handle `content_block_delta` with `type: "input_json_delta"`: concatenate `partial_json` to a buffer
- [x] 4.6 Handle `content_block_stop`: if current block is `tool_use`, `JSON.parse` the accumulated JSON buffer into `input` (with try/catch for malformed JSON)
- [x] 4.7 Handle `message_delta`: capture `stop_reason`
- [x] 4.8 Add unit tests for the accumulator: text-only stream, tool_use stream with input_json_delta, mixed text + tool_use, malformed JSON produces error

## 5. Agent Loop

- [x] 5.1 Implement `runAgentLoop` function that takes messages, tool registry, model config, and a write function for stdout
- [x] 5.2 In the loop: call `streamMessage()` with tool definitions from registry, consume stream via accumulator, append assistant message to history
- [x] 5.3 On `stop_reason: "end_turn"`: return (loop complete)
- [x] 5.4 On `stop_reason: "tool_use"`: extract `ToolUseBlock` entries from content blocks, look up each in registry, execute, collect `ToolResult` objects
- [x] 5.5 For unknown tool names: produce `ToolResultBlock` with `isError: true` and "tool not found" message
- [x] 5.6 Append a user message with `ToolResultBlock` array (one per tool call, matching `tool_use_id`) to conversation history
- [x] 5.7 Add iteration limit constant (10) and stop with a warning if exceeded
- [x] 5.8 Add unit tests for agent loop: single text response (no tool use), single tool call then text response, unknown tool name produces error result, iteration limit triggers warning

## 6. REPL Integration

- [x] 6.1 Refactor `src/repl.ts` to use `runAgentLoop` instead of inline stream consumption
- [x] 6.2 Create tool registry in `startRepl` and pass it to the agent loop
- [x] 6.3 Construct user messages as `{ role: "user", content: [{ type: "text", text: input }] }`
- [x] 6.4 Update REPL to read assistant text from returned `ContentBlock[]` (extract text from `TextBlock` entries for display confirmation)
- [x] 6.5 Run `npm run typecheck` and `npm test` to verify full integration

## 7. Manual Testing

- [x] 7.1 Manual test: prompt the agent to read a specific file (e.g., "Read the contents of package.json") and verify it calls `read_file` and displays the file contents in its response
- [x] 7.2 Manual test: prompt the agent to read multiple files sequentially (e.g., "Read tsconfig.json and package.json and summarize them") and verify multiple tool calls
- [x] 7.3 Manual test: prompt the agent to read a non-existent file (e.g., "Read /tmp/does-not-exist.txt") and verify it receives the structured error and responds gracefully
- [x] 7.4 Manual test: prompt the agent with a question that needs no file access (e.g., "What is 2+2?") and verify no tool call is made — just a text response
