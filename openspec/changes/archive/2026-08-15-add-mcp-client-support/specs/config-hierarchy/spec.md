## ADDED Requirements

### Requirement: MCP server config format
Each config file MAY define an `mcpServers` object keyed by server name. Each server entry SHALL support `command` (string), `args` (string array), `env` (string-to-string object), and `enabled` (boolean).

#### Scenario: Valid MCP server config is parsed
- **WHEN** a config file contains `{ "mcpServers": { "filesystem": { "command": "npx", "args": ["-y", "@modelcontextprotocol/server-filesystem", "."], "enabled": true } } }`
- **THEN** the system SHALL parse the `filesystem` server entry successfully

### Requirement: MCP server config merge order
The resolved `mcpServers` object SHALL merge in the same order as the rest of config: global < project < local. Server names SHALL be merged by key, and later scopes SHALL override scalar fields while preserving unspecified earlier fields for the same server.

#### Scenario: Later scope overrides one field for an existing server
- **WHEN** global config defines `mcpServers.filesystem.command` and `args`
- **AND** local config defines only `mcpServers.filesystem.enabled: false`
- **THEN** the resolved `filesystem` server SHALL retain the earlier command and args
- **AND** use `enabled: false` from the later scope
