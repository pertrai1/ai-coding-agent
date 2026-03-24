## ADDED Requirements

### Requirement: Bash tool definition
The system SHALL register a `bash` tool with a `command` string input parameter. The tool description MUST indicate that it executes a shell command and returns stdout, stderr, and exit code.

#### Scenario: Bash tool is registered in the tool registry
- **WHEN** `createToolRegistry()` is called
- **THEN** the registry contains a tool named `"bash"` with a valid definition including `name`, `description`, and `input_schema` with a required `command` property of type `string`

### Requirement: Bash tool executes shell commands
The `bash` tool SHALL execute the provided `command` string in a shell process using `child_process.execFile` with `/bin/sh -c`. The tool MUST wait for the process to complete before returning results.

#### Scenario: Successful command execution
- **WHEN** the `bash` tool is called with `{ "command": "echo hello" }`
- **THEN** the tool returns a result containing stdout `"hello\n"`, empty stderr, and exit code `0`

#### Scenario: Command with non-zero exit code
- **WHEN** the `bash` tool is called with a command that exits with code 1
- **THEN** the tool returns a result containing the stderr output and exit code `1`
- **AND** the result has `isError: true`

### Requirement: Bash tool returns structured output
The `bash` tool SHALL return a formatted string containing labeled sections for stdout, stderr, and exit code. All three fields MUST always be present in the output, even when empty.

#### Scenario: Output format with stdout and stderr
- **WHEN** a command produces both stdout and stderr output
- **THEN** the result content contains clearly labeled stdout, stderr, and exit code sections

#### Scenario: Output format with empty stderr
- **WHEN** a command produces only stdout and exits with code 0
- **THEN** the result content still includes an empty stderr section and exit code 0

### Requirement: Bash tool input validation
The `bash` tool SHALL validate that the `command` input is a non-empty string. If validation fails, the tool MUST return an error result without spawning a process.

#### Scenario: Missing command parameter
- **WHEN** the `bash` tool is called with an empty or missing `command`
- **THEN** the tool returns `isError: true` with a message indicating command is required

### Requirement: Bash tool handles process errors
The `bash` tool SHALL handle process-level errors (e.g., shell not found, spawn failures) and return them as structured error results rather than throwing unhandled exceptions.

#### Scenario: Process spawn failure
- **WHEN** the shell process fails to spawn
- **THEN** the tool returns `isError: true` with a descriptive error message
- **AND** no unhandled exception propagates to the agent loop
