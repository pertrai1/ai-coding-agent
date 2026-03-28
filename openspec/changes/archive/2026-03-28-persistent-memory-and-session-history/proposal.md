## Why

The agent currently forgets everything when the process exits. Step 5 added context compression inside a live session, but there is still no durable project memory, no saved session history, and no way to resume a prior conversation. That makes the agent weaker across restarts and forces users to restate stable facts and recent progress.

Step 7 should add persistence without blurring two different concepts:

- **Durable memory**: explicit project facts the user wants the agent to keep across fresh sessions
- **Session history**: a resumable transcript of one conversation, plus a lightweight summary for future sessions

Keeping those concerns separate gives us clearer UX, simpler retention rules, and a path to future improvements without turning every old chat transcript into "memory."

## What Changes

- Add project-scoped persistent storage under `<project-root>/.ai-agent/` for memories and saved sessions.
- Introduce a memory store with:
  - per-memory entry files
  - an index file for lookup metadata
  - internal `remember`, `recall`, and `forget` operations surfaced through REPL slash commands rather than model-callable tools
- Save completed sessions to disk with:
  - full transcript and token metadata for resume
  - a separate session summary artifact for lightweight future context
- Add CLI resume support with `--resume <sessionId>` so session rehydration happens during startup, not mid-REPL.
- On fresh sessions, load active durable memories and recent session summaries as hidden bootstrap context without restoring full prior transcripts.

## Capabilities

### New Capabilities

- `memory-store`: durable project memory with explicit remember/recall/forget lifecycle
- `session-history`: persistent transcript storage, session summaries, and resume by session identifier

### Modified Capabilities

- `cli-bootstrap`: startup can resume a saved session when `--resume` is provided
- `repl-chat-loop`: supports memory commands and distinct bootstrap flows for fresh vs. resumed sessions

## Impact

- **Filesystem**: creates and reads `.ai-agent/memory/` and `.ai-agent/sessions/` inside the project root.
- **REPL UX**: adds `/remember`, `/recall`, and `/forget` commands; normal chat remains unchanged.
- **Startup flow**: new sessions and resumed sessions now bootstrap differently.
- **Context strategy**: fresh sessions gain durable facts and recent summaries, but not full prior chat turns.
- **No model tool surface**: memory remains an internal product feature, not a tool the model can invoke directly.
