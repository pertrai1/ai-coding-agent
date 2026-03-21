## Why

The CLI currently prints a bootstrap message and exits. To become an actual AI coding agent, it needs an interactive conversation loop — a REPL that accepts user input, sends it to Claude via the Anthropic Messages API with streaming, and displays tokens as they arrive. This is the foundational interaction model that every subsequent feature (tool calling, file editing, context management) builds on top of.

## What Changes

- Add an Anthropic REST client wrapper that authenticates with `ANTHROPIC_API_KEY` and sends messages to the `/v1/messages` endpoint with streaming enabled.
- Add request mapping that converts internal conversation history into the Anthropic messages format.
- Add Server-Sent Events (SSE) stream parsing to extract `content_block_delta` tokens from the streaming response.
- Add a terminal REPL loop using Node.js `readline` that prompts for user input and renders streamed assistant tokens in real time.
- Store conversation history in memory as an ordered array of user/assistant messages, included in full with each API request.
- Handle `exit` and `quit` typed commands to gracefully end the session.
- Handle `SIGINT` (Ctrl+C) for clean process termination without stack traces.
- Catch API and network errors and display a friendly error message instead of crashing.
- **BREAKING**: The CLI's default action changes from printing a bootstrap message to launching the interactive REPL. The `--help` and `--version` flags continue to work as before.

## Capabilities

### New Capabilities
- `anthropic-client`: HTTP client wrapper for the Anthropic Messages API — handles authentication, request construction, and SSE stream parsing.
- `repl-chat-loop`: Interactive terminal REPL with streaming response rendering, conversation history management, graceful shutdown, and error handling.

### Modified Capabilities
- `cli-bootstrap`: The default CLI action changes from printing a static message to launching the REPL chat loop. Requires `ANTHROPIC_API_KEY` to be set (error on missing key instead of warning).

## Impact

- **`src/cli.ts`**: Default action replaced with REPL launch. API key validation becomes a hard requirement.
- **New source files**: Anthropic client module and REPL module added under `src/`.
- **No new dependencies**: Uses Node.js built-in `readline` and `https`/`fetch` for HTTP. No additional npm packages.
- **Network dependency**: The REPL requires a live connection to `api.anthropic.com`. Offline usage produces a handled error.
- **CI**: Existing smoke checks (`--help`, `--version`) are unaffected. The REPL won't launch during CI because no interactive stdin is provided.
