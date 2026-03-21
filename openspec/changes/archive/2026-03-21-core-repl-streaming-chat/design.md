## Context

The CLI (`src/cli.ts`) currently boots with commander, loads `.env` via `dotenv/config`, reads `ANTHROPIC_API_KEY` from `process.env`, prints a bootstrap message, and exits. There is no interactive loop, no HTTP client, and no conversation state. The `scripts/verify-api.sh` curl example demonstrates the Anthropic Messages API call pattern: `POST /v1/messages` with `x-api-key`, `anthropic-version: 2023-06-01`, and `content-type: application/json` headers.

Step 1 transforms this one-shot CLI into a persistent interactive session.

## Goals / Non-Goals

**Goals:**
- Establish the core agent loop: user input → API call → streamed response → repeat
- Build a reusable Anthropic client module that future steps (tool calling, compression) can extend
- Render assistant tokens to the terminal in real time as they stream in
- Maintain full conversation history in memory and send it with each request
- Handle all expected failure modes (missing API key, network errors, malformed responses) without crashing

**Non-Goals:**
- Tool calling (Step 2)
- File editing or codebase search (Steps 2-3)
- Shell command execution (Step 4)
- Context window management or conversation compression (Step 5)
- Configuration hierarchy or project context loading (Step 6)
- Persistent memory or session history (Step 7)
- Using the Anthropic TypeScript SDK — we call the REST API directly per REQUIREMENTS.md guidance
- Fancy terminal UI (e.g., ink, blessed) — plain readline + chalk is sufficient

## Decisions

### 1. Native `fetch` over `node:https` or third-party HTTP libraries

**Decision**: Use Node.js 20+ built-in `fetch` (globally available, no import needed) for HTTP requests.

**Rationale**: `fetch` returns a `Response` with a `body: ReadableStream` that supports async iteration via `getReader()`, which maps cleanly to SSE stream processing. Node 20+ ships `fetch` as a stable global — no polyfill or dependency needed. The alternative `node:https` requires manual chunk reassembly with `IncomingMessage` events and doesn't offer a clean streaming abstraction.

**Alternatives considered**:
- `node:https` — lower-level, more boilerplate for streaming, no built-in JSON response helpers
- `axios` / `node-fetch` — unnecessary dependency when native `fetch` covers the use case

### 2. Custom SSE line parser over EventSource or third-party SSE libraries

**Decision**: Implement a lightweight SSE parser that reads lines from the `ReadableStream`, accumulates `event:` and `data:` fields, and emits parsed events on blank-line boundaries.

**Rationale**: The Anthropic streaming API uses standard SSE format but is consumed via `POST` requests (not `GET`), which rules out the browser `EventSource` API. Node.js has no built-in SSE parser. Third-party libraries (`eventsource-parser`, etc.) would add a dependency for ~50 lines of code. The SSE spec is simple: fields are `event:`, `data:`, separated by blank lines — straightforward to parse correctly.

**Alternatives considered**:
- `eventsource-parser` npm package — adds dependency for trivial logic
- `EventSource` polyfill — designed for `GET` requests, awkward to retrofit for `POST`

### 3. `node:readline/promises` for the REPL input loop

**Decision**: Use the `readline/promises` module (Node.js 20+) with `createInterface` for user input.

**Rationale**: Provides `rl.question(prompt)` as an async/await API, handles line editing, and integrates with `process.stdin`/`process.stdout`. The promises-based API avoids callback nesting in the main loop. Alternatives like `inquirer` or `prompts` are designed for one-shot form inputs, not persistent REPL sessions.

**Alternatives considered**:
- `readline` (callback-based) — works but requires wrapping in promises manually
- `inquirer` / `prompts` — over-engineered for a REPL, designed for CLI wizards

### 4. `AsyncGenerator` for streaming token delivery

**Decision**: The Anthropic client exposes streaming as an `AsyncGenerator<StreamEvent>` that the REPL consumes with `for await...of`.

**Rationale**: AsyncGenerator provides natural backpressure — the client only reads the next chunk when the consumer is ready. It composes cleanly with the REPL rendering loop: `for await (const event of stream) { process.stdout.write(text) }`. It's also easy to abort via `generator.return()` if we later need cancellation. The alternative (EventEmitter) scatters control flow across `.on()` handlers and doesn't provide backpressure.

**Alternatives considered**:
- `EventEmitter` — no backpressure, scattered control flow, harder to reason about
- Callback per event — awkward nesting, no natural way to signal completion

### 5. Conversation history as a plain array of message objects

**Decision**: Store history as `Array<{ role: 'user' | 'assistant'; content: string }>` in the REPL module. Pass the full array to the Anthropic client on each request.

**Rationale**: The Anthropic Messages API expects `messages: [{role, content}]` — our internal format matches the API format directly, avoiding a mapping layer in Step 1. Future steps (tool calling) will extend the `content` field to support block arrays, but for now string content is sufficient. A class wrapper or state machine would over-engineer what is fundamentally an append-only list.

### 6. File structure: two new modules under `src/`

**Decision**:
- `src/api/anthropic.ts` — Anthropic client (HTTP + SSE parsing + type definitions)
- `src/repl.ts` — REPL loop (readline, conversation history, rendering, signal handling)
- `src/cli.ts` — updated to validate API key and launch the REPL

**Rationale**: Separating the API client from the REPL keeps concerns isolated. The client module handles HTTP, auth, and protocol parsing. The REPL module handles user interaction and conversation state. The CLI entrypoint ties them together. This separation means Step 2 (tool calling) only extends the API client types and REPL loop logic without touching HTTP/SSE code.

### 7. System prompt as a constant, not configurable (yet)

**Decision**: Use a hardcoded system prompt string in the REPL module for Step 1. Configuration comes in Step 6.

**Rationale**: Step 1 needs a system prompt to tell Claude it's a coding assistant, but the config system doesn't exist yet. A simple constant string is sufficient and avoids premature abstraction. Step 6 will replace it with a configurable prompt loaded from project context.

### 8. API key validation: fail-fast on REPL launch, not on CLI boot

**Decision**: Check for `ANTHROPIC_API_KEY` when the REPL starts. If missing, print an error message and exit with code 1. `--help` and `--version` still work without the key.

**Rationale**: Users should be able to run `--help` and `--version` without an API key (CI smoke tests depend on this). Only the REPL requires a live API connection, so validation happens at the point of need. This preserves the existing CI workflow and makes the error message contextually relevant ("can't start chat without an API key").

## Risks / Trade-offs

**[Risk] SSE parsing edge cases** → The Anthropic API may send `ping` events, multi-line `data:` fields, or events with `\r\n` line endings. Mitigation: handle `ping` (discard), join multi-line data with `\n`, strip trailing `\r`.

**[Risk] Stream interruption mid-response** → Network drops or API errors during streaming leave a partial assistant message. Mitigation: wrap the stream consumer in try/catch. On error, print what was received so far, display an error message, and let the user continue the REPL. Do not add the partial response to conversation history.

**[Risk] Large responses fill the terminal** → Long code blocks or explanations flood stdout. Mitigation: not addressed in Step 1. Step 5 (context management) and future UX improvements will handle this. For now, all tokens render directly.

**[Risk] No request cancellation** → Once a request is sent, there's no way to abort it mid-stream (e.g., user presses Ctrl+C during a response). Mitigation: For Step 1, Ctrl+C during a stream will exit the process cleanly via SIGINT handling. Future steps can add per-request `AbortController` support.

**[Trade-off] No retry logic** → Failed requests are reported to the user, not retried. This is intentional for Step 1 — the user can simply re-send their message. Automatic retries add complexity around idempotency and user expectations.

**[Trade-off] Full history sent every request** → Conversation history grows unbounded in Step 1. This will eventually hit context limits. Step 5 addresses this with compression. For Step 1, sessions are expected to be short enough that this isn't a practical issue.
