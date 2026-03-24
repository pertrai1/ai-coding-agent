## Context

The agent currently has five filesystem tools (`read_file`, `write_file`, `edit_file`, `glob`, `grep`) registered in a `ToolRegistry` (Map-based, defined in `src/tools/index.ts`). The agent loop in `src/agent.ts` executes every tool call unconditionally — no permission checks exist. The REPL in `src/repl.ts` owns the readline interface and stdout, which is where approval prompts need to render.

Tools follow a consistent pattern: each exports a `ToolRegistration` with a `definition` (Anthropic API schema) and an async `execute` function returning `ToolResult { content, isError? }`.

## Goals / Non-Goals

**Goals:**

- Add a `bash` tool that runs shell commands and returns structured output.
- Introduce a permission layer that checks tool permissions before execution.
- Support three permission modes: `allow`, `prompt`, `deny`.
- Render clear approval prompts for `prompt`-mode tools in the REPL.
- Handle denied tool calls gracefully so the model can adapt.

**Non-Goals:**

- Configurable permissions via config files (Step 6 concern).
- Command allowlists/blocklists for the bash tool (future hardening).
- Timeout or resource limits for bash commands (can be added later).
- Sandboxing or chroot for shell execution.

## Decisions

### 1. Bash tool uses `child_process.execFile` with `/bin/sh -c`

**Choice**: Use `execFile("/bin/sh", ["-c", command])` rather than `exec(command)`.

**Why over alternatives**:
- `exec(command)` spawns a shell implicitly but buffers output and has a default `maxBuffer` limit. It also takes a string directly, making the API surface less explicit.
- `execFile` with explicit shell args gives the same shell interpretation but with a clearer contract and easier transition to future options (e.g., timeout, cwd).
- `spawn` would require manual stream collection. Since we need the complete result (not streaming), `execFile` with promisify is simpler.

**Result shape**: Return a formatted string with stdout, stderr, and exit code sections — not JSON. This keeps tool results readable to the model without parsing overhead.

### 2. Permission mode stored per-tool in the registry

**Choice**: Extend `ToolRegistration` with a `permission` field (`"allow" | "prompt" | "deny"`). The registry becomes the single source of truth for tool metadata including permissions.

**Why over alternatives**:
- A separate permissions map would require keeping two data structures in sync.
- Embedding permissions in tool registration keeps tool metadata co-located and makes it easy for future config loading (Step 6) to set permissions at registration time.
- Default values are set at registration: `allow` for `read_file`, `glob`, `grep`; `prompt` for `write_file`, `edit_file`, `bash`.

### 3. Permission check happens in the agent loop, not in tool executors

**Choice**: Insert a permission check in the `for (const toolUse of toolUseBlocks)` loop in `src/agent.ts`, before calling `registration.execute()`.

**Why over alternatives**:
- Checking inside each tool's `execute` function would duplicate logic across every tool and mix concerns (permission is an agent-level policy, not a tool-level behavior).
- A middleware/wrapper approach adds indirection without benefit at this scale.
- The agent loop already handles tool errors — adding permission denial as another result type fits naturally.

### 4. Approval prompt uses a callback passed through AgentLoopOptions

**Choice**: Add a `promptForApproval: (toolName: string, toolInput: Record<string, unknown>) => Promise<boolean>` callback to `AgentLoopOptions`. The REPL provides the implementation that renders the prompt and reads y/n input.

**Why over alternatives**:
- Importing readline directly into the agent loop would couple it to terminal I/O and break testability.
- An event emitter adds complexity for a simple request/response interaction.
- A callback keeps the agent loop I/O-agnostic — tests can provide a stub that auto-approves or auto-denies. The REPL provides the real implementation using its existing readline interface.

### 5. Denial returns a structured `ToolResult` with `isError: true`

**Choice**: When a tool is denied (either by user declining a prompt or by `deny` mode), return a `ToolResult` with a clear message like `"Tool call denied by user: <tool_name>"` and `isError: true`.

**Why**: This follows the existing error-handling pattern. The model already knows how to interpret `is_error: true` results and adapt its approach. No new result types or special handling needed.

### 6. Approval prompt format

**Choice**: Display tool name and a formatted summary of the arguments, then ask `Allow? (y/n)`. For bash, show the command. For file tools, show the file path and a preview of the operation.

**Format**:
```
⚡ Tool: bash
  command: npm test
  Allow? (y/n):
```

**Why**: Showing the full tool input lets users make informed decisions. Keeping it compact avoids overwhelming the terminal during multi-tool sequences.

## Risks / Trade-offs

**[Risk] Bash commands can be destructive** → The permission system defaults bash to `prompt` mode, requiring explicit user approval for each invocation. This is the primary safety mechanism for now; command-level restrictions can be layered in later.

**[Risk] Long-running bash commands block the agent loop** → Accepted for now. Adding timeouts is a non-goal for this step. Users can Ctrl+C to interrupt.

**[Risk] Approval prompts interrupt multi-tool flows** → When the model requests multiple `prompt`-mode tools in one turn, the user must approve each one sequentially. This is intentional — batched auto-approval would undermine the safety benefit.

**[Trade-off] Permission defaults are hardcoded, not configurable** → Step 6 adds config-based overrides. For now, defaults are set in the tool registration code, which is easy to change but requires a code edit.
