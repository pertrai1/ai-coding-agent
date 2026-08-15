## ADDED Requirements

### Requirement: Dynamic tool registration honors permission overrides
When a tool is registered after the tool registry is created, the registry SHALL apply any matching configured permission override at registration time.

#### Scenario: Late-registered tool receives override
- **WHEN** `createToolRegistry()` is called with permission overrides `{ "mcp__filesystem__read_file": "deny" }`
- **AND** a tool named `mcp__filesystem__read_file` is registered later
- **THEN** that tool SHALL be stored with `permission: "deny"`

### Requirement: MCP tool default permission
MCP-discovered tools SHALL default to `prompt` unless a config override sets a different permission.

#### Scenario: MCP tool defaults to prompt
- **WHEN** an MCP tool is registered without a matching permission override
- **THEN** the tool SHALL have `permission: "prompt"`
