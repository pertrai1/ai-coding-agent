## Purpose

Per-tool permission system that controls whether tool calls execute immediately, require user approval, or are denied outright.

## Requirements

### Requirement: Permission mode type
Each tool registration SHALL include a `permission` field with one of three values: `"allow"`, `"prompt"`, or `"deny"`. This field MUST be part of the `ToolRegistration` type.

#### Scenario: Tool registration includes permission
- **WHEN** a tool is registered in the tool registry
- **THEN** the registration object includes a `permission` field set to `"allow"`, `"prompt"`, or `"deny"`

### Requirement: Default permission modes
The system SHALL assign default permission modes based on tool mutability. Read-only tools (`read_file`, `glob`, `grep`) MUST default to `"allow"`. Mutating tools (`write_file`, `edit_file`, `bash`) MUST default to `"prompt"`. After applying defaults, the system SHALL apply any permission overrides from the resolved config, where config-specified permissions replace the default for that tool.

#### Scenario: Read-only tools default to allow
- **WHEN** `createToolRegistry()` is called with no permission overrides
- **THEN** the tools `"read_file"`, `"glob"`, and `"grep"` have `permission: "allow"`

#### Scenario: Mutating tools default to prompt
- **WHEN** `createToolRegistry()` is called with no permission overrides
- **THEN** the tools `"write_file"`, `"edit_file"`, and `"bash"` have `permission: "prompt"`

#### Scenario: Config overrides default permission
- **WHEN** `createToolRegistry()` is called with permission overrides `{ "bash": "allow" }`
- **THEN** the `"bash"` tool SHALL have `permission: "allow"`
- **AND** all other tools retain their default permissions

#### Scenario: Config sets tool to deny
- **WHEN** `createToolRegistry()` is called with permission overrides `{ "write_file": "deny" }`
- **THEN** the `"write_file"` tool SHALL have `permission: "deny"`

#### Scenario: Config override for unknown tool is ignored
- **WHEN** `createToolRegistry()` is called with permission overrides `{ "unknown_tool": "allow" }`
- **THEN** the override for `"unknown_tool"` SHALL be silently ignored
- **AND** all registered tools retain their default permissions

### Requirement: Allow mode executes immediately
When a tool with `permission: "allow"` is called, the agent loop SHALL execute the tool immediately without any user interaction.

#### Scenario: Allowed tool runs without prompt
- **WHEN** the model requests `read_file` (permission: `"allow"`)
- **THEN** the tool executes immediately and the result is returned to the model
- **AND** no approval prompt is shown to the user

### Requirement: Prompt mode requires user approval
When a tool with `permission: "prompt"` is called, the agent loop SHALL display an approval prompt showing the tool name and its arguments, then wait for the user to approve or deny before proceeding.

#### Scenario: Prompted tool shows approval request
- **WHEN** the model requests `write_file` (permission: `"prompt"`)
- **THEN** the system displays the tool name and arguments to the user
- **AND** waits for the user to respond with approval or denial

#### Scenario: User approves prompted tool
- **WHEN** the user approves a prompted tool call
- **THEN** the tool executes and the result is returned to the model

#### Scenario: User denies prompted tool
- **WHEN** the user denies a prompted tool call
- **THEN** the tool does NOT execute
- **AND** a denial result is returned to the model

### Requirement: Deny mode rejects immediately
When a tool with `permission: "deny"` is called, the agent loop SHALL immediately return a denial result without executing the tool or prompting the user.

#### Scenario: Denied tool returns error without execution
- **WHEN** the model requests a tool with `permission: "deny"`
- **THEN** the tool does NOT execute
- **AND** a `ToolResultBlock` with `is_error: true` and a denial message is returned to the model
- **AND** no approval prompt is shown to the user

### Requirement: Denial result format
When a tool call is denied (by user declining a prompt or by `"deny"` mode), the system SHALL return a `ToolResult` with `isError: true` and a content string that clearly indicates the tool was denied, including the tool name.

#### Scenario: Denial result is structured
- **WHEN** a tool call for `"bash"` is denied
- **THEN** the result has `isError: true` and content includes the tool name and an indication it was denied

### Requirement: Approval prompt callback
The agent loop SHALL accept a `promptForApproval` callback in its options. This callback receives the tool name and input, and returns a `Promise<boolean>` indicating whether the user approved. The REPL SHALL provide an implementation that renders the prompt and reads user input.

#### Scenario: Agent loop uses callback for prompt-mode tools
- **WHEN** the agent loop encounters a tool with `permission: "prompt"`
- **THEN** it calls `promptForApproval(toolName, toolInput)` and awaits the boolean result

#### Scenario: Callback not provided skips prompting
- **WHEN** the agent loop is run without a `promptForApproval` callback
- **AND** a `prompt`-mode tool is requested
- **THEN** the tool call is denied with a structured error result

### Requirement: Approval prompt display
The approval prompt SHALL display the tool name and a formatted summary of the tool's input arguments. For the `bash` tool, the command string MUST be shown. The prompt SHALL ask the user to confirm with `y` (approve) or `n` (deny).

#### Scenario: Bash tool approval prompt format
- **WHEN** the model requests `bash` with `{ "command": "npm test" }`
- **THEN** the prompt displays the tool name `"bash"` and the command `"npm test"`
- **AND** asks the user to approve or deny

#### Scenario: File tool approval prompt format
- **WHEN** the model requests `write_file` with `{ "filePath": "src/index.ts", "content": "..." }`
- **THEN** the prompt displays the tool name `"write_file"` and the file path
- **AND** asks the user to approve or deny
