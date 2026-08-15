## Why

The agent currently only knows about tools compiled into this repository. That makes extension expensive because every new capability requires changing and shipping the core CLI. MCP client support lets the agent discover external tools at runtime from standard MCP servers, which opens the door to a broader tool ecosystem without turning the core agent into a monolith.

## What Changes

- Add runtime MCP client support for configured stdio servers using the official MCP SDK.
- Add `mcpServers` to the config hierarchy so users can declare external tool servers in global, project, or local config.
- Discover tools from connected MCP servers at REPL startup and register them as namespaced agent tools.
- Route MCP tool execution through the existing tool-calling loop and permission system.
- Default external MCP tools to `prompt`, allow per-tool permission overrides, and apply overrides to dynamically registered tools.
- Warn and continue when a configured MCP server cannot start or initialize.
- Exclude MCP tools from autonomous subagents and deny them during plan mode for this first release.

## Capabilities

### New Capabilities
- `mcp-client`: Configured stdio MCP server connectivity, tool discovery, namespaced registration, execution, and cleanup.

### Modified Capabilities
- `config-hierarchy`: Add `mcpServers` config parsing and merge behavior across scopes.
- `tool-permissions`: Apply permission overrides to dynamically registered tools and define safe defaults for MCP tools.
- `repl-chat-loop`: Initialize MCP servers before interactive use, warn on unavailable servers, and cleanly close them on shutdown.
- `plan-mode`: Deny MCP tools while plan mode is active.

## Impact

- **Source files**: New MCP runtime modules under `src/mcp/`; updates to `src/repl.ts`, `src/tools/index.ts`, and `src/config/*`.
- **Dependencies**: Add `@modelcontextprotocol/sdk` as a runtime dependency.
- **Configuration**: Extend JSON config files with `mcpServers` entries and optional per-tool permission overrides for namespaced MCP tools.
- **Runtime behavior**: The tool catalog becomes partially dynamic at startup based on configured external servers.
- **Security posture**: External tools are treated conservatively by default with prompt-based approval and plan-mode denial.
