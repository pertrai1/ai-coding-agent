## MODIFIED Requirements

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
