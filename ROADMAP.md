# AI Agent Implementation Roadmap

This roadmap translates `REQUIREMENTS.md` into phased, atomic tasks for building a TypeScript AI coding agent CLI. Every item is intentionally small and checkable.

## Step Zero - Environment and Project Bootstrap

- [x] Run `npm init` to create the project manifest.
- [x] Create `tsconfig.json` for a TypeScript Node.js CLI target.
- [x] Add `.env` loading support in the runtime bootstrap.
- [x] Read `ANTHROPIC_API_KEY` from process environment at startup.
- [x] Add `commander` as the CLI command parser dependency.
- [x] Add `chalk` as the terminal output styling dependency.
- [x] Add a basic `src/cli.ts` entrypoint that boots the app.
- [x] Add `dev`, `build`, `typecheck`, and `test` scripts to `package.json`.
- [x] Add a `curl` script or doc snippet to verify Anthropic API connectivity.
- [x] Create a small local playground project directory for tool testing.
- [x] Create a CI workflow file at `.github/workflows/ci.yml`.
- [x] Add a CI step to install dependencies.
- [x] Add a CI step to run `typecheck`.
- [x] Add a CI step to run `test`.
- [x] Add a CI step to run `build`.
- [x] Add a CI smoke check step that runs CLI `--help`.
- [x] Add a CI smoke check step that runs CLI `--version`.

## Step 1 - Core REPL and Streaming Chat Loop

- [x] Implement a terminal REPL loop that accepts user input.
- [x] Implement an Anthropic REST client wrapper with auth headers.
- [x] Implement request mapping from local messages to Anthropic message format.
- [x] Implement streaming event parsing for Anthropic responses.
- [x] Render streamed assistant tokens to the terminal as they arrive.
- [x] Store conversation history in memory as ordered messages.
- [x] Include full conversation history in each model request.
- [x] Handle `exit` and `quit` commands for graceful shutdown.
- [x] Handle `SIGINT` (Ctrl+C) for clean process termination.
- [x] Catch API/network errors and show a non-crashing error message.
- [x] Add a manual test for multi-turn context continuity.
- [x] Add a manual test for streaming behavior under normal network conditions.
- [x] Add a manual test: disconnect the network and send a message; verify graceful API error handling.
- [x] Add a manual test: press Ctrl+C during idle REPL; verify clean shutdown without stack trace.

## Step 2 - Tool Calling and `read_file`

- [x] Define a provider-compatible tool schema format (name, description, JSON input schema).
- [x] Register a `read_file` tool with a `filePath` input.
- [x] Implement `read_file` to return file text for valid paths.
- [x] Return structured errors when files do not exist.
- [x] Detect model tool-call responses in the agent loop.
- [x] Execute requested tool calls and capture their outputs.
- [x] Append tool results back into conversation history.
- [x] Repeat tool-execute-response cycle until text output is returned.
- [x] Add a manual test prompt that requires reading one file.
- [x] Add a manual test prompt that requires reading multiple files sequentially.
- [x] Add a manual test prompt that reads a non-existent file and verifies structured error handling.
- [x] Add a manual test prompt that needs no file access and verifies no tool call is made.

## Step 3 - Editing and Codebase Search Tools

- [x] Implement `edit_file` using `findText` + `replaceText` targeted replacement.
- [x] Implement `write_file` for full-file creation.
- [x] Implement `glob` for file pattern matching.
- [x] Implement `grep` for text search with path and line numbers.
- [x] Register all tools in the shared tool catalog.
- [x] Add argument validation for each tool input schema.
- [x] Return structured success/error payloads for all tool executions.
- [x] Add a manual test task that edits an existing function comment.
- [x] Add a manual test task that creates a brand-new file.
- [x] Add a manual test task that uses `glob` to list language-specific files.
- [x] Add a manual test task that uses `grep` to find symbol usage with line numbers.
- [x] Add a manual test task that refactors a symbol via search + multi-file edits.

## Step 4 - Bash Tool and Permissions

- [x] Implement a `bash` tool that executes shell commands.
- [x] Return `stdout`, `stderr`, and `exitCode` from `bash`.
- [x] Add per-tool permission modes: `allow`, `prompt`, `deny`.
- [x] Set defaults: `allow` for read-only tools, `prompt` for mutating tools.
- [x] Render approval prompts that clearly show tool name and arguments.
- [x] Resume tool execution when the user approves a prompt.
- [x] Return a structured rejection result when the user denies execution.
- [x] Ensure the agent adapts gracefully after a denied tool call.
- [x] Add a manual test where `bash` runs the project test command.
- [x] Add a manual test where `bash` is denied and the assistant continues safely.
- [x] Add a manual test where `read_file` is set to `allow` and runs without prompt.
- [x] Add a manual test with mixed tools (`allow` + `prompt`) and verify only prompted tools request approval.

## Step 5 - Context Window and Conversation Compression

- [x] Track prompt and completion token usage per model request.
- [x] Keep a running token total for the active session.
- [x] Define a compression threshold based on model context limits.
- [x] Implement a summarization routine for older conversation turns
- [x] Trigger summarization before context overflow occurs
- [x] Replace old turns with a summary while preserving recent turns verbatim
- [x] Keep compression operations hidden from normal user output
- [x] Expose a simple status command for current context usage
- [x] Add a manual long-session test that forces at least one compression cycle
- [x] Add a manual recall test that verifies important prior context is preserved

## Step 6 - Project Context and Config Hierarchy

- [x] Load `AGENTS.md` from project root when it exists.
- [x] Inject loaded project instructions into startup conversation context.
- [x] Define config files for global, project, and local scopes.
- [x] Implement config merge order: global < project < local.
- [x] Add config keys for provider/model defaults.
- [x] Add config keys for per-tool permission defaults.
- [x] Add config keys for extra system prompt text.
- [x] Handle missing config files without startup failure.
- [x] Add a manual test that verifies precedence across all three config scopes.
- [x] Add a manual test that verifies operation with no `AGENTS.md` present.

## Step 7 - Persistent Memory and Session History

- [x] Create a filesystem directory for long-term memory entries.
- [x] Create an index file for memory lookup metadata.
- [x] Implement a `remember` operation that stores durable facts.
- [x] Implement a `recall` operation that retrieves relevant memories.
- [x] Implement a `forget` operation that removes selected memories.
- [x] Save completed sessions to persistent storage.
- [x] Implement session resume by session identifier.
- [x] Summarize completed sessions for lightweight future context loading.
- [x] Load memory index data when a new session starts.
- [x] Inject relevant memories into new-session context without restoring prior chat turns.
- [x] Load prior session summaries for fresh sessions without loading full old transcripts.
- [x] Add a manual test for remember/recall/forget across process restarts.
- [x] Add a manual test that resumed sessions restore conversation continuity.
- [x] Add a manual test that fresh sessions keep memories but not prior conversation history.
- [x] Add a manual test prompt: "what do you remember?" and verify memory listing.

## Step 8 - Subagents and Plan Mode

- [x] Implement subagent spawning with isolated message history.
- [x] Allow parent agent to send a scoped task prompt to each subagent.
- [x] Give each subagent access to the same tool catalog as the main agent.
- [x] Collect subagent outputs and return a merged parent summary.
- [x] Keep subagent tool-call traces out of main chat transcript by default.
- [x] Add a plan-mode switch that disables mutating tools.
- [ ] Use a planner-oriented system prompt while in plan mode.
- [ ] Add explicit user approval flow to exit plan mode into execution mode.
- [ ] Execute approved plans as ordered actionable steps.
- [ ] Add a manual test where plan mode produces a plan without edits.
- [ ] Add a manual test where plan approval leads to controlled implementation.
- [ ] Add a manual test where plan rejection or modification revises the plan without execution.

## Going Further - Stretch Phases

- [ ] Add Model Context Protocol (MCP) client support for external tool servers.
- [ ] Add reusable skills with named prompts and tool bundles.
- [ ] Add lifecycle hooks (before tool, after edit, on startup).
- [ ] Add model switching inside an active session.
- [ ] Add non-interactive headless mode for scripting and automation.
- [ ] Add CI job coverage for headless execution paths.
