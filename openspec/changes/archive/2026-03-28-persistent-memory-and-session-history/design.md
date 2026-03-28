## Context

The current REPL stores conversation state, token totals, and compression artifacts entirely in memory. When the process exits:

- conversation history is lost
- token tracking is lost
- durable user facts are lost
- there is no session identifier to resume

Step 7 extends the agent from "good inside one process" to "useful across restarts," but that persistence needs clear boundaries.

## Goals / Non-Goals

**Goals**

- Preserve explicit project facts across process restarts
- Save completed sessions so they can be resumed by identifier
- Keep fresh-session context lightweight by loading summaries instead of full transcripts
- Avoid exposing memory as model-callable tools
- Keep storage local and inspectable on disk

**Non-Goals**

- Global cross-project memory
- Embeddings or vector search
- Automatic memory extraction from arbitrary conversation turns
- Mid-session resume commands
- Syncing memory or sessions to remote storage

## Decisions

### 1. Project-scoped storage under `.ai-agent/`

**Decision:** Store all Step 7 artifacts inside the current project's `.ai-agent/` directory.

**Layout:**

```text
.ai-agent/
  memory/
    index.json
    entries/
      <memoryId>.json
  sessions/
    <sessionId>.json
    <sessionId>.summary.json
```

**Rationale:**

- Durable knowledge is usually project-specific
- Stored artifacts stay close to the codebase they describe
- The repo already uses `.ai-agent/` for project config, so persistence fits the same mental model

**Alternatives considered:**

- Global home-directory storage: simpler reuse, but mixes unrelated projects
- Database/SQLite: more scalable, but unnecessary for this phase

### 2. Separate durable memory from session history

**Decision:** Durable memories and saved sessions are separate stores with different semantics.

**Rationale:**

- A remembered fact is curated and meant to survive many sessions
- A session transcript is incidental history, not automatically durable knowledge
- Different lifecycles become explicit: `/forget` removes memory, while session deletion or archival remains a separate concern

### 3. Internal memory operations via REPL commands

**Decision:** Implement `remember`, `recall`, and `forget` as internal app operations surfaced through slash commands:

- `/remember <text>`
- `/recall [query]`
- `/forget <memoryId>`

These are **not** registered as model-callable tools.

**Rationale:**

- Memory becomes a user-governed feature, not a model-governed side effect
- The system avoids storing speculative or low-quality facts just because the model asked
- REPL commands map cleanly onto the roadmap's "operation" wording without expanding the tool surface

### 4. Index-based recall, no embeddings

**Decision:** Use a JSON index with normalized text metadata for lookup and simple relevance scoring.

**Index fields per entry:**

- `id`
- `text`
- `createdAt`
- `updatedAt`
- `path`
- `tokens` (normalized word set for matching)

**Recall behavior:**

- `/recall <query>` ranks memories by case-insensitive token overlap
- `/recall` with no query lists all active memories in stable order

**Rationale:**

- Meets Step 7 needs without new dependencies or infrastructure
- Keeps recall explainable and easy to debug
- Leaves room for future retrieval upgrades without changing the outward contract

### 5. Fresh sessions load memory digests and recent summaries, not transcripts

**Decision:** Fresh sessions bootstrap with two hidden context blocks:

- a compact digest of active durable memories
- a compact list of recent completed session summaries

They do **not** restore full prior chat turns.

**Rationale:**

- Satisfies the roadmap requirement that memories persist across fresh sessions
- Preserves the distinction between "what the agent knows" and "what this exact chat said"
- Prevents runaway prompt growth from old transcripts

**Implementation note:** "Relevant memories" for a fresh session means active project memories currently present in the index, subject to a formatting cap. Relevance scoring is reserved for explicit `/recall` queries.

### 6. Resume happens only during CLI startup

**Decision:** Add `--resume <sessionId>` to the CLI and rehydrate the session before the REPL loop starts.

**Rationale:**

- Startup is the safest moment to restore transcript, token totals, and session metadata
- Mid-session replacement of history would create ambiguous state and surprising behavior
- The boot flow stays binary and understandable: new session or resumed session

### 7. Save transcript and summary as separate artifacts

**Decision:** Persist both:

- `sessions/<sessionId>.json` for exact resume
- `sessions/<sessionId>.summary.json` for lightweight future context

**Transcript contents:**

- session id
- created/updated timestamps
- model
- message history
- token usage totals

**Summary contents:**

- session id
- completed timestamp
- short summary text
- touched files and notable decisions when available

**Rationale:**

- Resume needs lossless history
- Fresh sessions need a cheap representation
- Keeping both artifacts separate avoids overloading one file with two jobs

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| Memory digest grows too large | Cap formatted startup memory context and prefer concise entries |
| Session summary generation fails | Save transcript anyway and fall back to a minimal metadata summary |
| Project `.ai-agent/` data is accidentally committed | Document ignore rules in implementation tasks and project docs |
| Recall quality is weaker than embeddings | Keep the contract simple now; improve scoring later behind the same interface |
| Users confuse memory with session resume | Separate commands, files, and CLI paths in both spec and UX |

## Open Questions

None for this change. The major boundary decisions are fixed:

- memory and session history stay separate
- memory operations remain internal
- resume occurs via `--resume <sessionId>` at startup
