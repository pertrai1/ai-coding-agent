## 1. Storage Foundation

- [ ] 1.1 Create a persistence module for project-scoped `.ai-agent/` storage paths
- [ ] 1.2 Create `.ai-agent/memory/index.json` discovery and initialization logic
- [ ] 1.3 Create memory entry read/write helpers for `.ai-agent/memory/entries/<memoryId>.json`
- [ ] 1.4 Create session transcript read/write helpers for `.ai-agent/sessions/<sessionId>.json`
- [ ] 1.5 Create session summary read/write helpers for `.ai-agent/sessions/<sessionId>.summary.json`

## 2. Durable Memory Operations

- [ ] 2.1 Implement `remember` to persist a durable memory entry and update the index
- [ ] 2.2 Implement `recall` to query indexed memories by normalized token overlap
- [ ] 2.3 Implement `forget` to remove a selected memory entry and delete its index record
- [ ] 2.4 Add REPL slash command handling for `/remember <text>`
- [ ] 2.5 Add REPL slash command handling for `/recall [query]`
- [ ] 2.6 Add REPL slash command handling for `/forget <memoryId>`
- [ ] 2.7 Add unit tests for memory index creation, remember, recall, forget, and restart-safe reload

## 3. Session Persistence

- [ ] 3.1 Generate a session identifier when starting a new session
- [ ] 3.2 Persist completed session transcripts with timestamps, model, messages, and token totals
- [ ] 3.3 Generate and persist a lightweight summary for each completed session
- [ ] 3.4 Add unit tests for transcript persistence and summary persistence

## 4. Resume and Fresh-Session Bootstrap

- [ ] 4.1 Add CLI `--resume <sessionId>` option and plumb it into REPL startup
- [ ] 4.2 Implement resume loading that rehydrates full transcript and token totals from a saved session
- [ ] 4.3 Fail startup cleanly when `--resume` references a missing or unreadable session
- [ ] 4.4 Load memory index data during fresh-session startup
- [ ] 4.5 Format active durable memories into hidden bootstrap context for fresh sessions
- [ ] 4.6 Load recent session summaries during fresh-session startup without loading prior transcripts
- [ ] 4.7 Add unit or integration tests for fresh-session bootstrap vs. resumed-session bootstrap

## 5. Manual Verification

- [ ] 5.1 Manual test: use `/remember`, `/recall`, and `/forget`, restart the process, and verify state persists correctly
- [ ] 5.2 Manual test: exit a session, restart with `--resume <sessionId>`, and verify full conversation continuity
- [ ] 5.3 Manual test: start a fresh session after prior saved work and verify memories persist without prior transcript restoration
- [ ] 5.4 Manual test: ask "what do you remember?" in a fresh session and verify the answer is grounded in injected durable memory context
