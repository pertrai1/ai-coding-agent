## 1. Anthropic Client — Types and Request Construction

- [x] 1.1 Create `src/api/anthropic.ts` with TypeScript type definitions for Anthropic SSE stream events (`MessageStartEvent`, `ContentBlockDeltaEvent`, `MessageDeltaEvent`, `MessageStopEvent`, etc.) and the `Message` type representing a conversation message (`{ role: 'user' | 'assistant'; content: string }`).
- [x] 1.2 Implement `createMessageStream()` function that accepts messages array, model string, system prompt, and API key — constructs the `POST /v1/messages` request body with `stream: true`, `max_tokens`, and required headers (`x-api-key`, `anthropic-version: 2023-06-01`, `content-type: application/json`) — and returns the `fetch` Response.
- [x] 1.3 Add error handling for the HTTP response: throw a structured `AnthropicError` (with status code and message) for non-2xx responses, and a descriptive error for network failures (DNS, connection refused, timeout).

## 2. Anthropic Client — SSE Stream Parsing

- [x] 2.1 Implement an SSE line parser that reads the `ReadableStream<Uint8Array>` body via `getReader()`, decodes chunks with `TextDecoder`, splits into lines, and accumulates `event:` and `data:` fields — emitting a parsed SSE object on each blank-line boundary. Handle `\r\n` line endings by stripping trailing `\r`.
- [x] 2.2 Implement the `streamMessage()` AsyncGenerator function that calls `createMessageStream()`, pipes the Response body through the SSE parser, discards `ping` events, throws on `error` events, joins multi-line `data:` fields with `\n`, parses JSON data into typed event objects, and yields them in order (`message_start` through `message_stop`).
- [x] 2.3 Extract token usage from stream events: capture `input_tokens` from the `message_start` event's `message.usage` and `output_tokens` from the `message_delta` event's `usage` — make both available to the caller (e.g., via a return value or final yield).

## 3. Anthropic Client — Unit Tests

- [x] 3.1 Add unit tests in `src/__tests__/anthropic.test.ts` for the SSE parser: verify correct parsing of `event:` + `data:` fields, blank-line boundaries, `\r\n` handling, multi-line data joining, and ping event discarding.
- [x] 3.2 Add unit tests for request construction: verify the fetch request body includes `model`, `max_tokens`, `stream: true`, `messages`, and `system` fields — and that headers include `x-api-key`, `anthropic-version`, and `content-type`.
- [x] 3.3 Add unit tests for error handling: verify non-2xx responses throw `AnthropicError` with status and message, network errors throw with descriptive message, and SSE `error` events throw with error details.

## 4. REPL Loop — Core Input/Output

- [x] 4.1 Create `src/repl.ts` with a `startRepl()` async function that creates a `readline/promises` interface on `process.stdin`/`process.stdout`, defines a hardcoded system prompt constant, and enters a loop calling `rl.question()` for user input.
- [x] 4.2 Implement the streaming render loop: for each user message, call `streamMessage()` from the Anthropic client, iterate over yielded events with `for await...of`, and write `content_block_delta` text deltas to the terminal using `process.stdout.write()`. Print a newline after the stream completes and re-prompt.
- [x] 4.3 Skip empty input (whitespace-only lines) — re-display the prompt without making an API call.

## 5. REPL Loop — Conversation History

- [x] 5.1 Maintain a `messages` array of `{ role, content }` objects in the REPL. Append the user message (role `"user"`) before each API call. Accumulate all `text_delta` content during streaming, and append the full assistant response (role `"assistant"`) only after the stream completes successfully.
- [x] 5.2 Pass the full `messages` array to `streamMessage()` on each request so the API receives complete conversation context.
- [x] 5.3 On stream error, do NOT append the partial assistant response to history. Display what was received so far and show the error message.

## 6. REPL Loop — Graceful Shutdown and Error Handling

- [x] 6.1 Detect `exit` and `quit` commands (case-insensitive, trimmed) — print a goodbye message using chalk and call `rl.close()` then `process.exit(0)`.
- [x] 6.2 Register a `SIGINT` handler that prints a newline, closes the readline interface, and exits with code 0 — no stack trace.
- [x] 6.3 Wrap the stream consumption in try/catch: on `AnthropicError`, display the status code and error message using chalk; on network errors, display a user-friendly network error message. In both cases, re-display the input prompt to continue the REPL.

## 7. CLI Entrypoint Update

- [x] 7.1 Update `src/cli.ts` default `program.action()` to be async: validate that `ANTHROPIC_API_KEY` is set — if missing, print an error with chalk and `process.exit(1)`. If present, import and call `startRepl()` from `src/repl.ts`.
- [x] 7.2 Verify `--help` and `--version` continue to work without an API key (no regression from existing CI smoke tests).

## 8. REPL Unit Tests

- [x] 8.1 Add unit tests in `src/__tests__/repl.test.ts` for exit command detection: verify `exit`, `quit`, `EXIT`, `Quit` are recognized as exit commands, and other inputs are not.
- [x] 8.2 Add unit tests for empty input handling: verify whitespace-only strings are treated as empty and skip API calls.
- [x] 8.3 Add unit tests for conversation history: verify user messages are appended before API call, assistant messages are appended after successful stream, and partial responses are not appended on error.

## 9. Manual Integration Tests

- [ ] 9.1 Manual test: start the agent and have a multi-turn conversation — ask a question, then a follow-up referencing the previous answer. Verify the model understands context from earlier turns.
- [ ] 9.2 Manual test: verify responses stream to the terminal incrementally (tokens appear one by one) rather than appearing all at once after a delay.
- [ ] 9.3 Manual test: disconnect the network and send a message — verify the agent displays a friendly error message and returns to the prompt without crashing.
- [ ] 9.4 Manual test: press Ctrl+C during idle REPL — verify clean shutdown with no stack trace. Also test typing `exit` and `quit`.

## 10. Documentation and ROADMAP Update

- [x] 10.1 Write `FOR-Rob-Simpson.md` explaining Step 1: the REPL architecture, how SSE streaming works, how conversation history flows through the system, the design decisions and their rationale, lessons learned, and how good engineers think about building interactive CLI tools.
- [x] 10.2 Mark all Step 1 items complete in `ROADMAP.md` by changing `- [ ]` to `- [x]` for each completed item.
