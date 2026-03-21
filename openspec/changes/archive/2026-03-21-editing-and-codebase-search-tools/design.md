## Context

The agent currently has a single tool (`read_file`) registered in a `ToolRegistry` backed by a `Map<string, ToolRegistration>`. Each tool exports a `ToolRegistration` object containing a `ToolDefinition` (name, description, JSON input schema) and an `execute` function that returns `Promise<ToolResult>` where `ToolResult = { content: string; isError?: boolean }`.

The agent loop in `src/agent.ts` detects `stop_reason: "tool_use"`, extracts `ToolUseBlock` entries, calls `registry.get(name).execute(input)`, and appends `ToolResultBlock` messages to the conversation. This loop is tool-count agnostic — adding new tools requires only implementing the file and registering it.

The runtime is Node.js 24 (target ES2022, ESM). No external file-system dependencies are installed.

## Goals / Non-Goals

**Goals:**
- Add four tools (`edit_file`, `write_file`, `glob`, `grep`) that follow the identical pattern established by `read_file`
- Use only Node.js built-in APIs — no new npm dependencies
- Each tool validates its inputs at runtime and returns structured error payloads (never throws)
- The model can compose these tools in multi-step workflows (search → read → edit cycles)

**Non-Goals:**
- Permission/approval system for mutating tools (that's Step 4)
- Undo/rollback for file edits (out of scope)
- Streaming or pagination for large result sets
- Regex support in `edit_file` find text (plain text only — safer for AI-driven edits)
- Watch mode or incremental search

## Decisions

### Decision 1: One file per tool, same export pattern

Each tool lives in `src/tools/<tool-name>.ts` and exports a named `ToolRegistration` constant (e.g., `editFileTool`, `writeFileTool`). This mirrors `read-file.ts` exactly.

**Why not a single file?** Each tool has distinct imports and error-handling logic. Separate files keep diffs focused and make the tool catalog scannable. The registry file (`index.ts`) stays minimal — just imports and `register()` calls.

### Decision 2: `edit_file` requires a unique match

When `findText` appears **zero times** → error ("text not found"). When it appears **more than once** → error ("multiple matches found — provide more surrounding context to uniquely identify the edit location"). When it appears **exactly once** → perform the replacement.

**Why?** AI models sometimes generate ambiguous search strings that match in multiple locations. Requiring uniqueness forces the model to include enough surrounding context, preventing silent edits in the wrong place. Real-world agents (Claude Code, Cursor) use this approach. The error message guides the model to self-correct by providing a longer `findText`.

**Alternatives considered:**
- Replace-first: Simpler but hides ambiguity from the model — it wouldn't know it picked the wrong location.
- Replace-all: Useful for renames but dangerous for targeted edits. Can be achieved by the model calling `edit_file` multiple times.

### Decision 3: `write_file` creates parent directories automatically

If the target path includes directories that don't exist, `write_file` creates them with `mkdir({ recursive: true })` before writing. This matches how `mkdir -p` works and avoids a common failure mode where the model forgets to create directories first.

**Why?** The model's workflow is "decide file path → write content." Forcing a separate directory-creation step adds friction and failure surface. The `recursive: true` option is idempotent and safe.

### Decision 4: Use `node:fs/promises` `glob` for file pattern matching

Node.js 22+ provides `glob()` in `node:fs/promises`. Since the runtime is Node.js 24, we use the built-in directly. No npm dependency needed.

**Why not `fast-glob` or `tinyglobby`?** The project principle (from AGENTS.md) is "Do not install dependencies unless explicitly listed in the task." The built-in glob supports standard patterns (`**/*.ts`, `src/**`) which covers the agent's needs. If advanced patterns are needed later, a dependency can be added.

**API shape:** `glob(pattern, { cwd })` returns an async iterable. We'll collect results into an array and return them as newline-separated paths in the `content` string.

### Decision 5: `grep` uses plain string splitting, not `node:readline`

Read entire file with `readFile`, split on `\n`, test each line against the pattern. Return matches formatted as `filePath:lineNumber:lineContent`.

**Why not `node:readline`?** For an AI agent scanning project files, simplicity wins. Files in a typical codebase fit in memory. `readline` adds async stream complexity for no practical benefit in this context. If performance becomes an issue with very large files, we can add streaming later.

**Pattern matching:** The `grep` tool accepts a plain string pattern (default) or a regex pattern string. The tool tries to construct a `RegExp` from the pattern and falls back to literal `String.includes()` if the regex is invalid. This gives the model flexibility without requiring it to escape regex syntax.

### Decision 6: `grep` searches recursively from a base path

The tool accepts a `path` (directory or file) and a `pattern`. If `path` is a directory, it uses the built-in `glob('**/*', { cwd: path })` to find all files, reads each one, and searches for the pattern. If `path` is a file, it searches just that file.

An optional `include` parameter (glob pattern like `*.ts`) filters which files to search within the directory. This avoids searching `node_modules`, binary files, etc.

### Decision 7: All tools use the same validation pattern

Each `execute` function performs `typeof` checks on required inputs at the top and returns `{ content: "Error: ...", isError: true }` for invalid input. No centralized validation framework — matches the existing `read_file` pattern exactly.

**Why not add a schema validator?** YAGNI. Four tools with 2-3 params each don't justify a validation library. The per-tool checks are readable, testable, and consistent with what's already in the codebase.

## Risks / Trade-offs

**[Risk] Large glob results overwhelm the context window** → Mitigation: The `glob` tool returns file paths only (not contents). For very large results, the model can refine its pattern. A future enhancement could add a `limit` parameter.

**[Risk] `grep` on large directories is slow** → Mitigation: The `include` parameter limits which files are searched. Binary files are skipped by catching UTF-8 decode errors. For now, this is sufficient — performance optimization is a future concern.

**[Risk] `edit_file` unique-match requirement confuses the model** → Mitigation: The error message explicitly tells the model what to do ("provide more surrounding context"). Models are good at self-correcting from clear error messages.

**[Risk] `write_file` silently overwrites existing files** → Mitigation: This is intentional — the model needs to be able to update files. Step 4 adds a permission system that will prompt before mutating operations. For now, the tool trusts the model.

**[Risk] No new dependency needed but `node:fs/promises` glob is relatively new** → Mitigation: The API is stable in Node.js 22+ and the project runtime is Node.js 24. No compatibility concern.
