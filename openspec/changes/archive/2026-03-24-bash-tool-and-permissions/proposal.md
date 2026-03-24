## Why

The agent can read, write, edit, and search files but cannot run shell commands — so it can't execute tests, install dependencies, run builds, or interact with any CLI tooling. Additionally, all tools execute unconditionally with no user oversight, meaning a model request to overwrite a critical file happens silently. Step 4 of the roadmap adds a `bash` tool for shell execution and a permission layer that gives users control over which tool calls require approval.

## What Changes

- Add a `bash` tool that spawns a child process, runs a shell command, and returns `stdout`, `stderr`, and `exitCode` as a structured result.
- Introduce a per-tool permission system with three modes: `allow` (execute immediately), `prompt` (ask user before executing), and `deny` (reject with structured error).
- Assign default permission modes: `allow` for read-only tools (`read_file`, `glob`, `grep`), `prompt` for mutating tools (`write_file`, `edit_file`, `bash`).
- Render clear approval prompts in the REPL showing tool name and arguments when a tool is in `prompt` mode.
- Resume tool execution on user approval; return a structured rejection result on denial.
- Ensure the agent loop handles denied tool calls gracefully — the model receives the denial and can adapt its plan.

## Capabilities

### New Capabilities

- `bash-tool`: Shell command execution tool returning stdout, stderr, and exit code.
- `tool-permissions`: Per-tool permission system with allow/prompt/deny modes, approval prompts, and denial handling.

### Modified Capabilities

- `tool-calling`: The agent loop must check permissions before executing any tool and handle denial results.

## Impact

- **Code**: New tool implementation in `src/tools/`, new permission module, modifications to agent loop in `src/agent.ts` and REPL in `src/repl.ts`.
- **Tools**: All existing tools gain a permission mode property; defaults preserve current behavior for read-only tools (`allow`) but add prompts for mutating tools.
- **Dependencies**: Node.js `child_process` module (built-in) for the bash tool. No new npm packages required.
- **UX**: Users will now see approval prompts for write/edit/bash operations, which is a visible behavior change from the current auto-execute flow.
