## 1. OpenSpec And Dependency Setup

- [x] 1.1 Add `@modelcontextprotocol/sdk` to `package.json`
- [x] 1.2 Create OpenSpec delta specs for `mcp-client`, `config-hierarchy`, `tool-permissions`, `repl-chat-loop`, and `plan-mode`

## 2. MCP Runtime

- [x] 2.1 Create `src/mcp/client.ts` to initialize one stdio MCP server, list tools, call tools, and normalize results
- [x] 2.2 Create `src/mcp/manager.ts` to connect configured servers, register namespaced tools, collect warnings, and close clients on shutdown

## 3. Config And Registry Integration

- [x] 3.1 Extend config types, file parsing, validation, and merge behavior for `mcpServers`
- [x] 3.2 Update the tool registry so permission overrides apply when tools are registered dynamically
- [x] 3.3 Update subagent tool creation so subagents receive a registry without MCP tools

## 4. REPL Integration

- [x] 4.1 Initialize MCP servers during REPL startup before the first model call
- [x] 4.2 Surface startup warnings without aborting the session and close MCP connections during REPL shutdown
- [x] 4.3 Extend plan-mode denial so MCP tools are blocked while planning

## 5. Verification And Documentation

- [x] 5.1 Add focused tests for MCP client/manager behavior, config parsing/merge, dynamic permission overrides, REPL lifecycle, and plan-mode denial
- [x] 5.2 Update `README.md`, `docs/SOCRATIC_JOURNAL.md`, `docs/FOR-Rob-Simpson.md`, and `ROADMAP.md`
- [x] 5.3 Run lint, typecheck, tests, and build
