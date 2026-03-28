## MODIFIED Requirements

### Requirement: REPL input loop
The REPL SHALL continuously prompt the user for input using `node:readline/promises` and process each line as either a chat message or a slash command until the user exits. Supported slash commands SHALL include status queries and memory-management commands.

#### Scenario: Status command displays context usage
- **WHEN** the user types `/status` and presses Enter
- **THEN** the REPL SHALL display current token usage, percentage, and message count
- **AND** the REPL SHALL re-display the prompt without making an API call

#### Scenario: Remember command stores a durable fact
- **WHEN** the user types `/remember Always run npm test before commit`
- **THEN** the REPL SHALL invoke the internal remember operation
- **AND** SHALL re-display the prompt without sending that command to the model

#### Scenario: Recall command lists or searches memories
- **WHEN** the user types `/recall` or `/recall test`
- **THEN** the REPL SHALL invoke the internal recall operation
- **AND** SHALL re-display the prompt without sending that command to the model

#### Scenario: Forget command removes a memory
- **WHEN** the user types `/forget mem_123`
- **THEN** the REPL SHALL invoke the internal forget operation
- **AND** SHALL re-display the prompt without sending that command to the model

## ADDED Requirements

### Requirement: Session bootstrap mode
The REPL SHALL start in one of two bootstrap modes: fresh session or resumed session. Fresh sessions SHALL inject durable memory context and recent session summaries without restoring old chat turns. Resumed sessions SHALL restore the saved transcript for the requested session identifier.

#### Scenario: Fresh session injects durable memory context
- **WHEN** the CLI starts a fresh session
- **AND** active durable memories exist
- **THEN** the REPL SHALL provide those memories to the first model request as hidden bootstrap context
- **AND** SHALL NOT append prior full transcript turns to the active conversation history

#### Scenario: Fresh session injects recent session summaries
- **WHEN** the CLI starts a fresh session
- **AND** prior session summary artifacts exist
- **THEN** the REPL SHALL provide those summaries to the first model request as hidden bootstrap context
- **AND** SHALL NOT restore prior full transcripts

#### Scenario: Resumed session restores transcript
- **WHEN** the CLI starts with `--resume session_abc`
- **AND** a saved transcript exists for that identifier
- **THEN** the REPL SHALL initialize conversation history from that transcript
- **AND** continue appending new turns to the resumed session

### Requirement: Durable memory remains available in fresh sessions
Fresh sessions SHALL retain durable memories across process restarts even though prior conversation history is not restored.

#### Scenario: Fresh session can answer from durable memory after restart
- **WHEN** the user stored a durable memory in an earlier run
- **AND** the process is restarted into a fresh session
- **AND** the user asks "what do you remember?"
- **THEN** the assistant's answer SHALL be grounded in the injected durable memory context
- **AND** SHALL NOT depend on restoring the prior chat transcript
