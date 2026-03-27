## Why

Claude's context window is finite (200K tokens for Claude 3.5 Sonnet). In long coding sessions, conversation history grows until it eventually exceeds the model's limit, causing API errors and session failure. Users currently have no visibility into context usage and no mechanism to preserve session continuity when approaching limits.

**Why now?** Steps 0-4 established core agent functionality. Before adding more features (project context, persistent memory, subagents), we need to ensure sessions remain stable regardless of conversation length.

## What Changes

- Track prompt and completion token usage from each Anthropic API response
- Maintain a running session token total for context window awareness
- Define compression thresholds based on model context limits (trigger at ~80% capacity)
- Implement hybrid summarization: keep recent N turns verbatim, summarize middle turns via API call, drop oldest turns
- Trigger automatic compression before context overflow
- Keep compression operations silent (no user-facing output during normal operation)
- Add a `/status` command to display current context usage (tokens, percentage, message count)

## Capabilities

### New Capabilities

- `context-compression`: Token tracking, compression thresholds, hybrid summarization logic, and automatic triggering when approaching context limits

### Modified Capabilities

- `repl-chat-loop`: Add `/status` command to display context window usage; integrate with context-compression module for token tracking

## Impact

**Affected Files:**
- `src/agent.ts` — Capture and accumulate token usage from API responses
- `src/repl.ts` — Add `/status` command handling, integrate token tracker
- `src/api/anthropic.ts` — Already returns token usage (no changes needed)

**New Files:**
- `src/context/` — New module for context management
  - `tracker.ts` — Token usage tracking and session totals
  - `compression.ts` — Summarization routine and compression logic
  - `types.ts` — Shared types for context management

**Dependencies:**
- No new external dependencies (uses existing Anthropic API for summarization)

**Model Considerations:**
- Summarization calls use the same model (Claude 3.5 Sonnet)
- Compression cost: ~1-2K tokens per summarization call
- Break-even: Compression saves more tokens than it costs when applied to 10+ old turns
