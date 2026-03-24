## 1. Permission Types and Registry Changes

- [x] 1.1 Add `ToolPermission` type (`"allow" | "prompt" | "deny"`) and add `permission` field to `ToolRegistration` in `src/tools/index.ts`
- [x] 1.2 Add `permission` to each existing tool registration (`read_file`, `glob`, `grep` → `"allow"`; `write_file`, `edit_file` → `"prompt"`)
- [x] 1.3 Add unit tests verifying all existing tools have correct default permissions after `createToolRegistry()` is called

## 2. Bash Tool Implementation

- [x] 2.1 Create `src/tools/bash.ts` with tool definition (name `"bash"`, `command` string input parameter)
- [x] 2.2 Implement `execute` using `child_process.execFile("/bin/sh", ["-c", command])` with promisified API
- [x] 2.3 Return formatted string with labeled stdout, stderr, and exit code sections; set `isError: true` for non-zero exit codes
- [x] 2.4 Add input validation returning error for missing/empty `command`
- [x] 2.5 Add error handling for process spawn failures (catch and return structured error)
- [x] 2.6 Register `bashTool` in `createToolRegistry()` with `permission: "prompt"`
- [x] 2.7 Add unit tests for bash tool: successful command, non-zero exit, missing command, structured output format

## 3. Permission Checks in Agent Loop

- [x] 3.1 Add optional `promptForApproval: (toolName: string, toolInput: Record<string, unknown>) => Promise<boolean>` to `AgentLoopOptions` in `src/agent.ts`
- [x] 3.2 Insert permission check before tool execution in the tool-use loop: `"allow"` → execute, `"deny"` → deny result, `"prompt"` → call callback
- [x] 3.3 When `promptForApproval` is not provided and a `"prompt"`-mode tool is requested, return a denial result
- [x] 3.4 Return denial `ToolResult` with `isError: true` and message including the tool name for both deny-mode and user-declined cases
- [x] 3.5 Add unit tests for permission check logic: allow executes, deny rejects, prompt calls callback, missing callback denies

## 4. Approval Prompt in REPL

- [x] 4.1 Implement `promptForApproval` function in `src/repl.ts` that renders tool name + input summary and reads y/n from readline
- [x] 4.2 Format prompt display: tool name, key arguments (command for bash, filePath for file tools), `Allow? (y/n)` prompt
- [x] 4.3 Pass `promptForApproval` callback to `runAgentLoop` in the REPL's call site
- [x] 4.4 Handle non-y/n input (treat anything other than `y`/`Y` as denial)

## 5. Integration and Manual Testing

- [x] 5.1 Run typecheck and fix any type errors across all modified files
- [x] 5.2 Run existing test suite and verify no regressions
- [x] 5.3 Manual test: ask the agent to run `echo hello` via bash and verify approval prompt appears, then approve (documented in docs/MANUAL_TESTING.md Test 4.1)
- [x] 5.4 Manual test: deny a bash tool call and verify the agent adapts gracefully (documented in docs/MANUAL_TESTING.md Test 4.2)
- [x] 5.5 Manual test: verify `read_file` executes without a prompt (allow mode) (documented in docs/MANUAL_TESTING.md Test 4.3)
- [x] 5.6 Manual test: verify mixed tools in one turn — `read_file` (allow) + `write_file` (prompt) — only prompted tool asks for approval (documented in docs/MANUAL_TESTING.md Test 4.4)
