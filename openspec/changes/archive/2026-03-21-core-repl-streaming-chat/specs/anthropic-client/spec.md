## ADDED Requirements

### Requirement: Anthropic API authentication
The client SHALL authenticate requests to `https://api.anthropic.com/v1/messages` using the `ANTHROPIC_API_KEY` environment variable, sent as the `x-api-key` HTTP header.

#### Scenario: Authenticated request includes correct headers
- **WHEN** the client sends a message to the Anthropic API
- **THEN** the request includes headers `x-api-key` (set to `ANTHROPIC_API_KEY`), `anthropic-version: 2023-06-01`, and `content-type: application/json`

#### Scenario: Missing API key prevents request
- **WHEN** the client is asked to send a message and `ANTHROPIC_API_KEY` is not set
- **THEN** the client SHALL throw an error before making any HTTP request

### Requirement: Message request construction
The client SHALL accept an array of conversation messages and a model identifier, and construct a valid Anthropic Messages API request body with `stream: true`.

#### Scenario: Request body matches Anthropic format
- **WHEN** the client is called with messages `[{role: "user", content: "Hello"}]` and model `"claude-sonnet-4-20250514"`
- **THEN** the HTTP request body SHALL be JSON containing `model`, `max_tokens`, `stream: true`, and `messages` matching the input array

#### Scenario: System prompt is included when provided
- **WHEN** the client is called with a system prompt string
- **THEN** the request body SHALL include a `system` field with the prompt text

#### Scenario: Full conversation history is sent
- **WHEN** the client is called with multiple user and assistant messages
- **THEN** all messages SHALL appear in the `messages` array in their original order

### Requirement: SSE stream parsing
The client SHALL parse the Anthropic streaming response as Server-Sent Events, extracting typed events from the `event:` and `data:` fields.

#### Scenario: Text delta events are parsed
- **WHEN** the stream contains an SSE event with `event: content_block_delta` and `data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hello"}}`
- **THEN** the parser SHALL yield a parsed event object with `type: "content_block_delta"` and the nested `delta.text` value `"Hello"`

#### Scenario: Ping events are discarded
- **WHEN** the stream contains an SSE event with `event: ping`
- **THEN** the parser SHALL silently discard it and not yield any event

#### Scenario: Multi-line data fields are joined
- **WHEN** an SSE event contains multiple `data:` lines before the blank-line terminator
- **THEN** the parser SHALL join them with `\n` and parse the result as a single JSON payload

#### Scenario: Carriage return line endings are handled
- **WHEN** SSE lines end with `\r\n` instead of `\n`
- **THEN** the parser SHALL strip trailing `\r` characters and parse correctly

### Requirement: Streaming response as AsyncGenerator
The client SHALL expose the streaming response as an `AsyncGenerator` that yields parsed SSE events in order, starting with `message_start` and ending with `message_stop`.

#### Scenario: Events arrive in protocol order
- **WHEN** a streaming request completes successfully
- **THEN** the generator SHALL yield events in order: `message_start`, one or more `content_block_start`/`content_block_delta`/`content_block_stop` sequences, `message_delta`, and `message_stop`

#### Scenario: Generator completes after message_stop
- **WHEN** the stream emits a `message_stop` event
- **THEN** the generator SHALL complete (return, not throw)

### Requirement: Token usage extraction
The client SHALL extract input and output token counts from the streaming response events.

#### Scenario: Input tokens from message_start
- **WHEN** a `message_start` event is received with `message.usage.input_tokens: 25`
- **THEN** the client SHALL make the input token count `25` available to the caller

#### Scenario: Output tokens from message_delta
- **WHEN** a `message_delta` event is received with `usage.output_tokens: 42`
- **THEN** the client SHALL make the output token count `42` available to the caller

### Requirement: API error handling
The client SHALL catch HTTP errors and streaming errors and convert them into structured error objects rather than unhandled exceptions.

#### Scenario: Non-2xx HTTP response
- **WHEN** the Anthropic API returns a non-2xx status code (e.g., 401, 429, 500)
- **THEN** the client SHALL throw a structured error containing the status code and error message from the response body

#### Scenario: Network failure
- **WHEN** the HTTP request fails due to a network error (DNS failure, connection refused, timeout)
- **THEN** the client SHALL throw a structured error with a descriptive message indicating a network problem

#### Scenario: SSE error event
- **WHEN** the stream contains an SSE event with `event: error`
- **THEN** the client SHALL throw a structured error with the error details from the event data

#### Scenario: Stream interruption
- **WHEN** the response stream is interrupted before `message_stop` is received
- **THEN** the client SHALL throw a structured error indicating the stream was interrupted
