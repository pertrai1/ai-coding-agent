## ADDED Requirements

### Requirement: Content block message format
All messages in the conversation history SHALL use `content: ContentBlock[]` (an array of typed content blocks) instead of `content: string`. A `TextBlock` has shape `{ type: "text", text: string }`. A `ToolUseBlock` has shape `{ type: "tool_use", id: string, name: string, input: Record<string, unknown> }`. A `ToolResultBlock` has shape `{ type: "tool_result", tool_use_id: string, content: string, is_error?: boolean }`.

#### Scenario: User text message uses content block array
- **WHEN** the user enters plain text input "hello"
- **THEN** the message appended to conversation history is `{ role: "user", content: [{ type: "text", text: "hello" }] }`

#### Scenario: Assistant text response uses content block array
- **WHEN** the model returns a text-only response
- **THEN** the message appended to conversation history has `role: "assistant"` and `content` is an array containing one or more `TextBlock` objects

#### Scenario: Assistant tool call uses content block array
- **WHEN** the model returns a response with `stop_reason: "tool_use"`
- **THEN** the message appended to conversation history has `role: "assistant"` and `content` is an array containing a `ToolUseBlock` (and optionally preceding `TextBlock` objects)

#### Scenario: Tool result uses content block array
- **WHEN** a tool execution completes
- **THEN** the message appended to conversation history has `role: "user"` and `content` is an array containing a `ToolResultBlock` with the matching `tool_use_id`

### Requirement: Tool definition schema
Each tool SHALL be defined with a `name` (string), `description` (string), and `inputSchema` (JSON Schema object with `type: "object"`, `properties`, and `required`). The tool definition format MUST be compatible with the Anthropic Messages API `tools` parameter (mapped to `input_schema` in the request body).

#### Scenario: Tool definition matches Anthropic format
- **WHEN** the tool definitions are sent in an API request
- **THEN** each tool is serialized as `{ name, description, input_schema: { type: "object", properties, required } }` in the request body's `tools` array

### Requirement: Tool registry
The system SHALL maintain a tool registry that maps tool names to their definitions and executor functions. Tools MUST be registered before the agent loop starts. The registry SHALL expose a method to look up a tool by name and a method to get all tool definitions for API requests. The `createToolRegistry()` function SHALL register the following built-in tools: `read_file`, `edit_file`, `write_file`, `glob`, and `grep`.

#### Scenario: Registered tool is findable by name
- **WHEN** a tool named "read_file" is registered
- **AND** the registry is queried for "read_file"
- **THEN** the registry returns the tool's definition and executor function

#### Scenario: Unregistered tool name returns no result
- **WHEN** the registry is queried for a tool name that was never registered
- **THEN** the registry returns `undefined` or an equivalent indicator that no tool matches

#### Scenario: All definitions available for API request
- **WHEN** the system prepares an API request
- **THEN** the registry provides an array of all tool definitions formatted for the Anthropic `tools` parameter

#### Scenario: All built-in tools are registered by default
- **WHEN** `createToolRegistry()` is called
- **THEN** the registry contains tools named `"read_file"`, `"edit_file"`, `"write_file"`, `"glob"`, and `"grep"`
- **AND** each tool has a valid definition with `name`, `description`, and `input_schema`
- **AND** each tool has an executable `execute` function

### Requirement: Tools sent in API request
The `createMessageStream` function SHALL accept an optional `tools` parameter containing an array of tool definitions. When provided, the tool definitions MUST be included in the request body sent to the Anthropic API.

#### Scenario: Tools included in request body
- **WHEN** `createMessageStream` is called with a `tools` array containing one or more tool definitions
- **THEN** the HTTP request body includes a `tools` field with those definitions

#### Scenario: No tools omits the field
- **WHEN** `createMessageStream` is called without a `tools` parameter
- **THEN** the HTTP request body does NOT include a `tools` field

### Requirement: Streaming event types support tool use
The streaming event types SHALL support `tool_use` content blocks in `content_block_start` events and `input_json_delta` deltas in `content_block_delta` events. The system MUST accumulate `input_json_delta` partial JSON chunks and parse them into the complete tool input object when the content block stops.

#### Scenario: Tool use content block start event
- **WHEN** the stream emits a `content_block_start` event with `content_block.type === "tool_use"`
- **THEN** the event contains `id`, `name`, and an initial empty `input` object

#### Scenario: Input JSON delta events accumulate
- **WHEN** the stream emits one or more `content_block_delta` events with `delta.type === "input_json_delta"`
- **THEN** each event's `delta.partial_json` string is concatenated in order to form the complete JSON input

#### Scenario: Content block stop triggers input parsing
- **WHEN** a `content_block_stop` event follows accumulated `input_json_delta` chunks
- **THEN** the concatenated partial JSON is parsed into the tool's input object

### Requirement: Agent loop detects tool use
The agent loop SHALL detect when the model's response has `stop_reason: "tool_use"` (from the `message_delta` event). When detected, the loop MUST NOT treat the response as a final answer.

#### Scenario: Tool use stop reason triggers tool execution
- **WHEN** the stream's `message_delta` event has `stop_reason: "tool_use"`
- **THEN** the agent loop proceeds to execute the requested tool(s) instead of displaying a final response

#### Scenario: End turn stop reason ends the loop
- **WHEN** the stream's `message_delta` event has `stop_reason: "end_turn"`
- **THEN** the agent loop treats the response as the final answer and displays it

### Requirement: Agent loop executes tool calls
When a tool use response is detected, the agent loop SHALL extract all `ToolUseBlock` entries from the assistant's content blocks, look up each tool in the registry, and execute the tool's function with the parsed input. Each tool execution MUST produce a result string (success) or an error string with `is_error: true`.

#### Scenario: Single tool call is executed
- **WHEN** the assistant's response contains one `ToolUseBlock` with name "read_file"
- **THEN** the agent loop calls the `read_file` executor with the block's `input` and captures the result

#### Scenario: Unknown tool name produces error result
- **WHEN** the assistant's response contains a `ToolUseBlock` with a name not in the registry
- **THEN** the agent loop produces a `ToolResultBlock` with `is_error: true` and a message indicating the tool is not found

### Requirement: Agent loop appends results and continues
After executing tool calls, the agent loop SHALL append the assistant's message (with its content blocks including `ToolUseBlock`) to conversation history, then append a user message containing `ToolResultBlock`(s) matching each `tool_use_id`. The loop SHALL then make another API request with the updated conversation history and continue until the model produces a response with `stop_reason: "end_turn"`.

#### Scenario: Tool result appended and model re-invoked
- **WHEN** a tool execution completes with result "file contents here"
- **THEN** the conversation history contains the assistant's tool_use message followed by a user message with `{ type: "tool_result", tool_use_id: "<matching_id>", content: "file contents here" }`
- **AND** a new streaming request is made with the full updated conversation history

#### Scenario: Multiple tool call iterations
- **WHEN** the model responds with tool_use, the tool is executed, and the model responds with tool_use again
- **THEN** the agent loop executes the second tool call and continues until `stop_reason: "end_turn"`

### Requirement: Agent loop has iteration limit
The agent loop SHALL enforce a maximum number of tool-calling iterations to prevent infinite loops. When the limit is reached, the loop MUST stop and display the last available text content to the user with a warning.

#### Scenario: Iteration limit reached
- **WHEN** the agent loop has executed the maximum number of tool-calling iterations without receiving `stop_reason: "end_turn"`
- **THEN** the loop stops, displays any accumulated text content, and prints a warning that the iteration limit was reached

### Requirement: Text output displayed during tool use
During the agent loop, any `TextBlock` content in the assistant's response SHALL be streamed to the terminal as it arrives, even when the response also contains tool calls. The user MUST see the model's "thinking out loud" text before tool execution begins.

#### Scenario: Text before tool call is displayed
- **WHEN** the model responds with a `TextBlock` followed by a `ToolUseBlock`
- **THEN** the text content is streamed to the terminal before the tool is executed
