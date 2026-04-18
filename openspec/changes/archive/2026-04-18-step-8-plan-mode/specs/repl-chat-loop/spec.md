## MODIFIED Requirements

### Requirement: REPL input loop
The REPL SHALL continuously prompt the user for input using `node:readline/promises` and process each line as either a chat message or a slash command until the user exits. Supported slash commands SHALL include status queries, memory-management commands, and plan mode toggle commands. When plan mode is active, the prompt SHALL display `[plan] > ` instead of `> `.

#### Scenario: User enters a message
- **WHEN** the user types a message and presses Enter
- **THEN** the REPL SHALL send the message to the Anthropic API and display the streamed response

#### Scenario: Empty input is ignored
- **WHEN** the user presses Enter without typing anything
- **THEN** the REPL SHALL re-display the prompt without making an API call

#### Scenario: REPL re-prompts after response completes
- **WHEN** the assistant's streamed response finishes
- **THEN** the REPL SHALL print a newline and display the input prompt again

#### Scenario: Status command displays context usage
- **WHEN** the user types `/status` and presses Enter
- **THEN** the REPL SHALL display current token usage, percentage, message count, and plan mode status
- **AND** the REPL SHALL re-display the prompt without making an API call

#### Scenario: Status command shows warning near limit
- **WHEN** the user types `/status` and token usage is above 75% of context window
- **THEN** the status output SHALL include a warning that compression will trigger soon

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

#### Scenario: Plan command activates plan mode
- **WHEN** the user types `/plan` and presses Enter
- **THEN** the REPL SHALL activate plan mode
- **AND** the prompt SHALL change to `[plan] > `

#### Scenario: Plan off command deactivates plan mode
- **WHEN** the user types `/plan off` and presses Enter
- **THEN** the REPL SHALL deactivate plan mode
- **AND** the prompt SHALL revert to `> `

#### Scenario: Plan mode prompt indicator
- **WHEN** plan mode is active
- **THEN** the REPL SHALL display `[plan] > ` as the input prompt

#### Scenario: Plan mode approval prompt after response
- **WHEN** plan mode is active
- **AND** the agent loop completes with a text response
- **THEN** the REPL SHALL prompt the user with an approval question for the plan
- **AND** wait for the user to approve, reject, or modify
