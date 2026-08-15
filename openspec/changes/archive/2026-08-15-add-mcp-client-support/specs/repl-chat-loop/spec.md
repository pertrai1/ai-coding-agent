## ADDED Requirements

### Requirement: MCP startup before first model call
When resolved config includes enabled MCP servers, the REPL SHALL initialize them before the first model request so discovered tool definitions are available to the model from the beginning of the session.

#### Scenario: First request includes discovered MCP tools
- **WHEN** the REPL starts with a healthy configured MCP server
- **AND** the user sends the first chat message
- **THEN** the tool definitions sent to the model SHALL include the server's discovered namespaced MCP tools

### Requirement: MCP startup warnings are non-fatal
If MCP startup produces server-specific failures, the REPL SHALL display warnings and continue running.

#### Scenario: Startup warning does not abort the session
- **WHEN** an MCP server fails during startup
- **THEN** the REPL SHALL log a warning for that server
- **AND** SHALL continue accepting user input
