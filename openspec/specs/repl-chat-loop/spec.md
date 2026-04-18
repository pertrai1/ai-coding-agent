## Purpose

Define REPL chat-loop behavior for input handling, streaming output, conversation state, and runtime commands.

## Requirements

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

### Requirement: Token tracking integration
The REPL SHALL integrate with the token tracking module to accumulate token usage from each API response.

#### Scenario: Tokens accumulated after response
- **WHEN** an API response completes with token usage
- **THEN** the REPL SHALL pass the usage data to the token tracker

#### Scenario: Compression checked before each request
- **WHEN** the user sends a new message
- **THEN** the REPL SHALL check if compression is needed before making the API call
- **AND** if needed, compress the conversation history first

### Requirement: Streaming response rendering
The REPL SHALL render assistant response tokens to the terminal in real time as they arrive from the streaming API, rather than waiting for the full response.

#### Scenario: Tokens appear incrementally
- **WHEN** the Anthropic API streams `content_block_delta` events with text deltas `"Hello"`, `" world"`
- **THEN** the terminal SHALL display `"Hello"` first, then `" world"` appended, without waiting for the full response

#### Scenario: Output uses stdout.write for streaming
- **WHEN** delta tokens are received during streaming
- **THEN** the REPL SHALL use `process.stdout.write()` (not `console.log()`) to avoid inserting newlines between tokens

### Requirement: Conversation history management
The REPL SHALL maintain an ordered array of all user and assistant messages in memory and include the full history in each API request.

#### Scenario: User message is stored
- **WHEN** the user sends a message
- **THEN** the message SHALL be appended to conversation history with `role: "user"` before the API call

#### Scenario: Assistant response is stored
- **WHEN** the assistant's streamed response completes successfully
- **THEN** the full concatenated response text SHALL be appended to conversation history with `role: "assistant"`

#### Scenario: History is sent with each request
- **WHEN** the user sends their third message in a session
- **THEN** the API request SHALL include all previous user and assistant messages (messages 1 through 5) plus the new user message

#### Scenario: Partial responses are not stored
- **WHEN** the streaming response is interrupted by an error before completing
- **THEN** the partial assistant response SHALL NOT be added to conversation history

### Requirement: Graceful exit commands
The REPL SHALL exit cleanly when the user types `exit` or `quit` (case-insensitive, trimmed).

#### Scenario: User types exit
- **WHEN** the user types `exit` and presses Enter
- **THEN** the REPL SHALL print a goodbye message and terminate with exit code 0

#### Scenario: User types quit
- **WHEN** the user types `quit` and presses Enter
- **THEN** the REPL SHALL print a goodbye message and terminate with exit code 0

#### Scenario: Exit command is case-insensitive
- **WHEN** the user types `EXIT` or `Quit` or `Exit`
- **THEN** the REPL SHALL recognize the command and exit cleanly

### Requirement: SIGINT handling
The REPL SHALL handle `SIGINT` (Ctrl+C) for clean process termination without printing a stack trace.

#### Scenario: Ctrl+C during idle prompt
- **WHEN** the user presses Ctrl+C while the REPL is waiting for input
- **THEN** the process SHALL exit cleanly with no stack trace printed

#### Scenario: Ctrl+C during streaming response
- **WHEN** the user presses Ctrl+C while a response is streaming
- **THEN** the process SHALL exit cleanly with no stack trace printed

### Requirement: API and network error display
The REPL SHALL catch errors from the Anthropic client and display a user-friendly error message, then continue the REPL loop instead of crashing.

#### Scenario: Network error during request
- **WHEN** a network error occurs while sending a message (e.g., no internet connection)
- **THEN** the REPL SHALL display an error message describing the problem and re-display the input prompt

#### Scenario: API error during request
- **WHEN** the Anthropic API returns an error (e.g., 401 Unauthorized, 429 Rate Limited)
- **THEN** the REPL SHALL display the error status and message and re-display the input prompt

#### Scenario: Stream error during response
- **WHEN** the streaming response is interrupted mid-way
- **THEN** the REPL SHALL display what was received so far, show an error message, and re-display the input prompt

### Requirement: System prompt
The REPL SHALL assemble the system prompt dynamically from three sources in order: (1) the base coding assistant prompt, (2) `AGENTS.md` content wrapped in `<project-instructions>` delimiters if present, and (3) config-provided `systemPromptExtra` text if present. The assembled prompt SHALL be included in each API request.

#### Scenario: System prompt is sent with every request
- **WHEN** any message is sent to the Anthropic API
- **THEN** the request body SHALL include a `system` field with a prompt identifying the assistant as a coding agent

#### Scenario: System prompt with all sources
- **WHEN** `AGENTS.md` content is available
- **AND** config `systemPromptExtra` is set to `"Always explain your reasoning."`
- **THEN** the system prompt sent to the API SHALL contain the base prompt, followed by project instructions in delimiters, followed by `"Always explain your reasoning."`

#### Scenario: System prompt with no project instructions or extra text
- **WHEN** no `AGENTS.md` was loaded
- **AND** no `systemPromptExtra` is configured
- **THEN** the system prompt SHALL be the base coding assistant prompt only

#### Scenario: System prompt with only AGENTS.md
- **WHEN** `AGENTS.md` content is available
- **AND** no `systemPromptExtra` is configured
- **THEN** the system prompt SHALL be the base prompt followed by project instructions in delimiters

### Requirement: Model from config
The REPL SHALL use the model specified in the resolved config. If no model is specified in config, the REPL SHALL fall back to the built-in default model.

#### Scenario: Config specifies model
- **WHEN** resolved config has `model: "claude-haiku-4-5-20250514"`
- **THEN** the REPL SHALL pass `"claude-haiku-4-5-20250514"` as the model to the agent loop

#### Scenario: No model in config
- **WHEN** resolved config has no `model` key
- **THEN** the REPL SHALL use the built-in default model `"claude-sonnet-4-20250514"`

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
