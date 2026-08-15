## Context

The current agent starts with a static tool registry built from compiled-in tool registrations. `startRepl` creates the registry once, registers the built-in tools plus `subagent`, and then hands that registry to `runAgentLoop` for the rest of the session. Config loading already exists for model selection, extra system prompt text, and tool permission overrides, but there is no path for runtime-discovered tools or external protocol clients.

MCP support is cross-cutting because it touches configuration, startup sequencing, tool registration, permissions, plan-mode denial, subagent safety, shutdown cleanup, and documentation. The roadmap requirement is specifically about external tool servers, so this design focuses on MCP tool discovery and invocation, not MCP resources or prompts.

## Goals / Non-Goals

**Goals:**
- Support configured stdio MCP servers in the main REPL session.
- Discover MCP tools at startup and expose them to the model as normal tools.
- Reuse the existing tool-call loop, permission system, and tool-result format.
- Default MCP tools to `prompt`, support per-tool overrides, and keep startup resilient when servers fail.
- Deny MCP tools in plan mode and exclude them from autonomous subagents.

**Non-Goals:**
- HTTP or SSE-based MCP transports.
- MCP resources, prompts, or sampling.
- Capability-based read-only inference for MCP servers.
- Persisting MCP connection state across sessions.
- Making MCP tools available to subagents in this release.

## Decisions

### Decision 1: Use the official MCP SDK and support stdio only

**Choice:** Add `@modelcontextprotocol/sdk` and build the first release on stdio transports only.

**Rationale:** MCP transport and lifecycle details are protocol-heavy enough that hand-rolling them would add unnecessary risk. Stdio servers cover the common local-extension case and keep the security model narrower than remote transports.

**Alternatives considered:**
- Implement JSON-RPC manually. Rejected because the protocol complexity is not worth owning.
- Support HTTP from day one. Rejected because auth, network policy, and reconnect behavior would expand scope substantially.

### Decision 2: Treat MCP tools as dynamically registered normal tools

**Choice:** Introduce an MCP manager that connects to configured servers, lists tools, and registers each discovered tool into the existing `ToolRegistry` under a namespaced name like `mcp__filesystem__read_file`.

**Rationale:** The rest of the stack already knows how to describe tools to the model, execute them, and feed results back into conversation history. Reusing that seam avoids building a second execution path.

**Alternatives considered:**
- Maintain a separate MCP registry and special-case it in the agent loop. Rejected because it duplicates execution and permission logic.
- Flatten tool names without namespacing. Rejected because collisions with built-ins or between servers would be likely.

### Decision 3: Move permission override application into registration time

**Choice:** Change the registry so every `register()` call applies any matching permission override when the tool is inserted.

**Rationale:** The current override pass only runs once after built-ins are added, which means tools registered later do not receive configured overrides. MCP tools are discovered after startup work begins, so override application must be registration-aware.

**Alternatives considered:**
- Re-run a global override pass after all MCP tools are registered. Rejected because it still leaves late registrations brittle and is easy to forget.

### Decision 4: Conservative trust model for external tools

**Choice:** Default every MCP tool to `prompt`, regardless of the server-provided schema, and deny all MCP tools during plan mode.

**Rationale:** Tool schemas describe inputs, not safety. Prompting by default preserves user control, and plan mode remains a hard read-only boundary.

**Alternatives considered:**
- Infer read-only status from tool names or descriptions. Rejected because heuristics would be unreliable.
- Allow MCP tools in plan mode if configured to `allow`. Rejected because it weakens the plan-mode contract.

### Decision 5: Keep subagents on built-in tools only

**Choice:** Build a second registry for subagents that excludes MCP tools.

**Rationale:** Subagents execute without approval prompts, so giving them access to external tools would silently expand the agent's autonomous reach. The roadmap for subagents did not require external-server access.

**Alternatives considered:**
- Share the same registry with subagents. Rejected for safety.

### Decision 6: Warn and continue on server startup failures

**Choice:** If a configured MCP server fails to start, initialize, or list tools, log a warning and continue booting the REPL.

**Rationale:** MCP is an extension mechanism. One broken extension should not make the whole coding agent unusable.

**Alternatives considered:**
- Fail startup on any server error. Rejected because it makes optional integrations too fragile.

## Risks / Trade-offs

- **External tools can perform powerful actions** -> Mitigation: default to `prompt`, require explicit config, and deny during plan mode.
- **Server startup adds latency to REPL boot** -> Mitigation: connect once at startup and keep the session alive until shutdown.
- **Tool names can become verbose** -> Mitigation: use deterministic namespacing so permission overrides remain stable.
- **MCP result content can be richer than a string** -> Mitigation: normalize tool results into plain text for the current `ToolResult` contract.
- **Subagents lose access to some extensions** -> Mitigation: document the restriction clearly and revisit later with a safer approval model.
