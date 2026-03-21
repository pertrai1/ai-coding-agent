## ADDED Requirements

### Requirement: REPL input loop
The REPL SHALL continuously prompt the user for input using `node:readline/promises` and process each line as a chat message until the user exits.

#### Scenario: User enters a message
- **WHEN** the user types a message and presses Enter
- **THEN** the REPL SHALL send the message to the Anthropic API and display the streamed response

#### Scenario: Empty input is ignored
- **WHEN** the user presses Enter without typing anything
- **THEN** the REPL SHALL re-display the prompt without making an API call

#### Scenario: REPL re-prompts after response completes
- **WHEN** the assistant's streamed response finishes
- **THEN** the REPL SHALL print a newline and display the input prompt again

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
The REPL SHALL include a system prompt in each API request that establishes the assistant's role as a coding agent.

#### Scenario: System prompt is sent with every request
- **WHEN** any message is sent to the Anthropic API
- **THEN** the request body SHALL include a `system` field with a prompt identifying the assistant as a coding agent
