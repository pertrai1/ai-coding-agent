## MODIFIED Requirements

### Requirement: Tool registry
The system SHALL maintain a tool registry that maps tool names to their definitions and executor functions. Tools MUST be registered before the agent loop starts. The registry SHALL expose a method to look up a tool by name and a method to get all tool definitions for API requests. The `createToolRegistry()` function SHALL register the following built-in tools: `read_file`, `edit_file`, `write_file`, `glob`, `grep`, and `bash`.

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
- **THEN** the registry contains tools named `"read_file"`, `"edit_file"`, `"write_file"`, `"glob"`, `"grep"`, and `"bash"`
- **AND** each tool has a valid definition with `name`, `description`, and `input_schema`
- **AND** each tool has an executable `execute` function

### Requirement: Agent loop executes tool calls
When a tool use response is detected, the agent loop SHALL extract all `ToolUseBlock` entries from the assistant's content blocks, look up each tool in the registry, check the tool's permission mode, and either execute the tool, prompt the user for approval, or deny the call. Each tool execution MUST produce a result string (success) or an error string with `is_error: true`.

#### Scenario: Single tool call is executed
- **WHEN** the assistant's response contains one `ToolUseBlock` with name "read_file"
- **AND** the tool has `permission: "allow"`
- **THEN** the agent loop calls the `read_file` executor with the block's `input` and captures the result

#### Scenario: Unknown tool name produces error result
- **WHEN** the assistant's response contains a `ToolUseBlock` with a name not in the registry
- **THEN** the agent loop produces a `ToolResultBlock` with `is_error: true` and a message indicating the tool is not found

#### Scenario: Prompt-mode tool requires approval before execution
- **WHEN** the assistant's response contains a `ToolUseBlock` for a tool with `permission: "prompt"`
- **THEN** the agent loop requests user approval before executing the tool

#### Scenario: Denied tool produces error result
- **WHEN** a tool call is denied (by user or by deny mode)
- **THEN** the agent loop produces a `ToolResultBlock` with `is_error: true` and a denial message
- **AND** the loop continues to process remaining tool calls and sends results back to the model

### Requirement: Agent loop graceful denial handling
When a tool call is denied, the agent loop SHALL continue normally — sending the denial result to the model and allowing it to adapt its approach. The loop MUST NOT terminate or raise an error due to a denied tool call.

#### Scenario: Model adapts after denial
- **WHEN** a tool call is denied and the denial result is sent to the model
- **THEN** the agent loop makes another API request with the updated conversation history
- **AND** the model can respond with alternative tool calls or a text response
