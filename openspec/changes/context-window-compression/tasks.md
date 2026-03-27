## 1. Core Types and Module Structure

- [x] 1.1 Create `src/context/types.ts` with `TokenUsage`, `CompressionResult`, and `TokenTrackerOptions` types
- [x] 1.2 Create `src/context/index.ts` as public exports for the context module

## 2. Token Tracking

- [x] 3.1 Create `src/context/tracker.ts` with `TokenTracker` class
- [x] 3.2 Implement `addUsage(inputTokens, outputTokens)` method to accumulate tokens
- [x] 3.3 Implement `getTotals()` method returning current input/output/combined tokens
- [x] 3.4 Implement `getUsagePercentage()` method returning percentage of context window consumed
- [x] 3.5 Implement `needsCompression()` method returning true when above 80% threshold
- [x] 3.6 Implement `getMessageCount()` method returning number of message turns
- [x] 3.7 Write unit tests for `TokenTracker` in `src/__tests__/context/tracker.test.ts`

## 3. Conversation Compression

- [x] 4.1 Create `src/context/compression.ts` with `compressConversation()` function
- [x] 4.2 Implement logic to identify and preserve recent N turns verbatim (using slice)
- [x] 4.3 Implement summarization prompt construction for older turns
- [x] 4.4 Implement API call to Anthropic for summarization with 30-second timeout
- [x] 4.5 Implement fallback to truncation when summarization fails
- [x] 4.6 Implement replacement of old turns with summary message (plain user message)
- [x] 4.7 Write unit tests for compression logic in `src/__tests__/context/compression.test.ts`

## 4. Agent Loop Integration

- [x] 5.1 Modify `src/agent.ts` to capture `usage` from `streamMessage` result
- [x] 5.2 Pass usage data to `TokenTracker.addUsage()` after each response
- [x] 5.3 Check `needsCompression()` before each API call
- [x] 5.4 Call `compressConversation()` when compression is needed
- [x] 5.5 Write integration tests for token tracking in agent loop

## 5. REPL Integration and Status Command

- [x] 6.1 Create `TokenTracker` instance in `src/repl.ts` and pass to agent loop
- [x] 6.2 Add `/status` command detection in REPL input handling
- [x] 6.3 Implement status output formatter showing tokens, percentage, and message count
- [x] 6.4 Add warning indicator when usage is above 75%
- [x] 6.5 Write unit tests for `/status` command in `src/__tests__/repl.test.ts`

## 6. Manual Testing

- [ ] 7.1 Manual test: Start session, send several messages, verify `/status` shows increasing token counts
- [ ] 7.2 Manual test: Force compression by filling context to 80%+ and verify conversation continues
- [ ] 7.3 Manual test: After compression, verify recent turns are preserved verbatim
- [ ] 7.4 Manual test: After compression, ask "what were we discussing?" and verify key context is preserved
- [ ] 7.5 Manual test: Disconnect network during summarization, verify fallback to truncation works

## 7. Documentation and Cleanup
- [ ] 8.1 Update `docs/FOR-Rob-Simpson.md` with context compression architecture and lessons learned
- [ ] 8.2 Mark all Step 5 items complete in `ROADMAP.md`
- [ ] 8.3 Run full test suite and verify all tests pass
- [ ] 8.4 Run `typecheck` and verify no errors
