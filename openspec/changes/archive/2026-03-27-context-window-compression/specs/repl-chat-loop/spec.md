## MODIFIED Requirements

### Requirement: REPL input loop
The REPL SHALL continuously prompt the user for input using `node:readline/promises` and process each line as a chat message until the user exits. Special commands starting with `/` are handled as status queries.

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
- **THEN** the REPL SHALL display current token usage, percentage, and message count
- **AND** the REPL SHALL re-display the prompt without making an API call

#### Scenario: Status command shows warning near limit
- **WHEN** the user types `/status` and token usage is above 75% of context window
- **THEN** the status output SHALL include a warning that compression will trigger soon

## ADDED Requirements

### Requirement: Token tracking integration
The REPL SHALL integrate with the token tracking module to accumulate token usage from each API response.

#### Scenario: Tokens accumulated after response
- **WHEN** an API response completes with token usage
- **THEN** the REPL SHALL pass the usage data to the token tracker

#### Scenario: Compression checked before each request
- **WHEN** the user sends a new message
- **THEN** the REPL SHALL check if compression is needed before making the API call
- **AND** if needed, compress the conversation history first
