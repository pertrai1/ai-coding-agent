## Purpose

Model Context Protocol client support for external stdio tool servers, including discovery, execution, and lifecycle management.

## Requirements

### Requirement: Configured stdio MCP server connectivity
The system SHALL support connecting to configured MCP servers over stdio during REPL startup. Each server configuration MUST include a unique server name and command, and MAY include argument and environment-variable overrides.

#### Scenario: Configured server starts successfully
- **WHEN** resolved config includes an enabled MCP server with a command and optional arguments
- **THEN** the REPL SHALL start that server over stdio during startup
- **AND** initialize an MCP client session for it before the first model request

#### Scenario: Disabled server is skipped
- **WHEN** resolved config includes an MCP server with `enabled: false`
- **THEN** the REPL SHALL NOT attempt to start that server

### Requirement: MCP tool discovery and namespacing
For each successfully initialized MCP server, the system SHALL discover its advertised tools and register them in the main tool registry using deterministic namespaced tool names of the form `mcp__<serverName>__<toolName>`.

#### Scenario: Discovered tool is namespaced
- **WHEN** the MCP server `filesystem` advertises a tool named `read_file`
- **THEN** the agent SHALL register a tool named `mcp__filesystem__read_file`
- **AND** expose that namespaced tool definition to the model

### Requirement: MCP tool execution
When the model requests a registered MCP tool, the system SHALL call the corresponding MCP server tool with the provided JSON input and convert the result into the agent's `ToolResult` string format.

#### Scenario: MCP tool returns text content
- **WHEN** a registered MCP tool returns text content from the server
- **THEN** the system SHALL return that text to the model as the tool result content

#### Scenario: MCP tool returns non-text content
- **WHEN** a registered MCP tool returns structured or mixed content
- **THEN** the system SHALL normalize the result into a deterministic plain-text representation

### Requirement: Unavailable server does not block startup
If a configured MCP server fails to start, initialize, or list tools, the REPL SHALL log a warning and continue startup without registering tools from that server.

#### Scenario: One server fails while another succeeds
- **WHEN** two MCP servers are configured
- **AND** one server fails during initialization
- **THEN** the REPL SHALL continue starting
- **AND** tools from the healthy server SHALL remain available

### Requirement: MCP lifecycle cleanup
The system SHALL close active MCP client sessions and transports when the REPL exits.

#### Scenario: REPL shutdown closes MCP connections
- **WHEN** the REPL exits after MCP servers were initialized
- **THEN** the system SHALL close each active MCP client session and transport once

### Requirement: MCP tools are excluded from subagents
The system SHALL NOT expose MCP-discovered tools to autonomous subagents in this release.

#### Scenario: Subagent registry excludes MCP tool names
- **WHEN** the main REPL has registered MCP tools
- **AND** the agent spawns a subagent
- **THEN** the subagent tool registry SHALL omit all tools whose names start with `mcp__`
