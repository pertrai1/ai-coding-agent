## ADDED Requirements

### Requirement: Plan mode denies MCP tools
When plan mode is active, the agent loop SHALL deny all MCP-discovered tools whose names begin with `mcp__`, regardless of their configured permission.

#### Scenario: MCP tool denied in plan mode
- **WHEN** plan mode is active
- **AND** the model requests `mcp__filesystem__read_file`
- **THEN** the tool call SHALL be denied with `isError: true`
- **AND** the content SHALL indicate the tool was denied because plan mode is active
- **AND** the tool SHALL NOT execute
