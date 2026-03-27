## Context

The agent currently maintains an in-memory `Message[]` array in `src/repl.ts` that grows unbounded. The Anthropic API already returns token usage (`input_tokens` from `message_start`, `output_tokens` from `message_delta`), but this data is discarded after each response. When the conversation exceeds the model's context window (~200K tokens for Claude 3.5 Sonnet), API requests fail with a context length error.

**Current State:**
- Messages stored in `src/repl.ts` as `Message[]`
- Token usage extracted in `src/api/anthropic.ts` but not persisted
- No visibility into context consumption
- No compression or summarization mechanism

## Goals / Non-Goals

**Goals:**
- Track cumulative token usage per session
- Automatically compress conversation history before context overflow
- Preserve recent turns verbatim for conversation continuity
- Provide user visibility into context usage via `/status` command
- Keep compression operations transparent (no output unless error)

**Non-Goals:**
- Persistent token tracking across sessions (future: Step 7)
- User-triggered manual compression (could be added later)
- Configurable compression thresholds (use sensible defaults for now)
- Different summarization models (use same model as main conversation)

## Decisions

### 1. Token Tracking Architecture

**Decision:** Create a `TokenTracker` class in `src/context/tracker.ts` that maintains session state.

**Rationale:** Encapsulating token state in a dedicated class allows:
- Single source of truth for session totals
- Easy injection into agent loop and REPL
- Future extensibility for cross-session persistence

**Alternatives Considered:**
- Inline tracking in `agent.ts` — would scatter token logic across files
- Global singleton — harder to test and reason about

### 2. Compression Trigger Strategy

**Decision:** Trigger compression at 80% of context window (160K tokens for 200K limit).

**Rationale:** 
- Leaves buffer for the next user message and response
- Avoids edge cases where a single large message could overflow
- Gives summarization room to work

**Alternatives Considered:**
- 90% threshold — too close to limit, risky with large messages
- Fixed message count — doesn't account for message size variance

### 3. Hybrid Compression Algorithm

**Decision:** Keep last 6 turns (3 user + 3 assistant) verbatim, summarize middle section, drop oldest.

```
Before compression: [turn1, turn2, turn3, ..., turn15, turn16, turn17, turn18]
After compression:  [summary of turns 1-12] + [turn13, turn14, turn15, turn16, turn17, turn18]
```

**Rationale:**
- Recent context is most relevant for ongoing work
- Middle turns contain valuable decisions that shouldn't be lost
- Oldest turns are often setup/context that's already been acted on

**Alternatives Considered:**
- Keep only last 2 turns — too aggressive, loses important context
- Summarize everything except last turn — loses conversation flow
- No summarization (just truncation) — free but loses too much information

### 4. Summarization Prompt Design

**Decision:** Use a structured summarization prompt that extracts:
- Key decisions made
- Files created/modified
- Current task state
- Important context for continuing

**Prompt Template:**
```
Summarize the following conversation turns, preserving:
1. Key decisions and their rationale
2. Files that were read, created, or modified
3. The current task or goal being worked on
4. Any important context needed to continue

Be concise but comprehensive. Focus on information over phrasing.
```

### 5. `/status` Command Output Format

**Decision:** Display token usage with percentage and visual indicator.

```
Context: 45,230 / 200,000 tokens (22.6%)
Messages: 12 turns
Status: OK
```

When approaching threshold:
```
Context: 162,500 / 200,000 tokens (81.3%)
Messages: 34 turns  
Status: ⚠ Approaching limit - compression will trigger soon
```

### 6. Module Structure

```
src/context/
├── types.ts          # TokenUsage, CompressionResult, etc.
├── tracker.ts        # TokenTracker class
├── compression.ts    # compressConversation() function
└── index.ts          # Public exports
```

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| Summarization loses critical context | Keep more recent turns verbatim; use structured prompt |
| Summarization API call fails | Retry once, then continue with truncated history |
| Compression happens during sensitive operation | Compression only triggers between turns, never mid-response |
| Token counting differs from actual API usage | Use Anthropic's reported tokens, not estimates |
| Large single message exceeds threshold | Log warning, still attempt compression after message |

## Open Questions

1. **Should compression be visible to users?** 
   - Current design: Silent operation
   - Alternative: Brief "[Compressing conversation...]" message
   - **Decision for now:** Silent, but log to stderr for debugging

2. **What if summarization produces a very long summary?**
   - Current design: Accept whatever the model produces
   - Future: Add max_tokens to summarization request
   - **Decision for now:** No token limit on summary; monitor in practice
