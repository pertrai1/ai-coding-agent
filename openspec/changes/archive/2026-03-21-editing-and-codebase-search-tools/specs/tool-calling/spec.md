## MODIFIED Requirements

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
