## Why

The agent can currently read files but cannot modify them or search the codebase. Without editing and search tools, the agent is limited to a read-only assistant — it cannot refactor code, create new files, or locate symbols across a project. Step 3 of the roadmap adds these capabilities to make the agent genuinely useful for coding tasks.

## What Changes

- Add an `edit_file` tool that performs targeted find-and-replace within existing files (preserving surrounding content).
- Add a `write_file` tool that creates new files or overwrites existing files with provided content.
- Add a `glob` tool that matches file paths against glob patterns (e.g., `**/*.ts`) for project structure discovery.
- Add a `grep` tool that searches file contents by text pattern and returns matching lines with file paths and line numbers.
- Register all four new tools in the shared tool registry alongside `read_file`.
- Add runtime argument validation for every tool input schema (consistent with `read_file`'s existing validation pattern).
- Return structured `{ content, isError }` payloads from all tool executions (consistent with existing `ToolResult` type).

## Capabilities

### New Capabilities
- `edit-file-tool`: Targeted find-and-replace editing within existing files. Takes a file path, search text, and replacement text; performs the substitution and returns confirmation or structured error.
- `write-file-tool`: Full-file creation or overwrite. Takes a file path and content string; writes the file to disk and returns confirmation or structured error.
- `glob-tool`: File pattern matching across the project directory. Takes a glob pattern (and optional base path); returns a list of matching file paths.
- `grep-tool`: Content search across files with location info. Takes a search pattern (and optional path scope); returns matching lines with file paths and line numbers.

### Modified Capabilities
- `tool-calling`: The tool registry's `createToolRegistry()` function must register the four new tools alongside `read_file`. No behavioral changes to the registry or agent loop — only additional `registry.register()` calls.

## Impact

- **New files**: `src/tools/edit-file.ts`, `src/tools/write-file.ts`, `src/tools/glob.ts`, `src/tools/grep.ts`
- **Modified files**: `src/tools/index.ts` (import and register new tools)
- **Test files**: New test files in `src/__tests__/` for each tool
- **Dependencies**: May need `glob` npm package (or use `node:fs` with recursive directory walking). The `grep` tool will use `node:fs/promises` and `node:readline` or simple string matching — no external dependency needed.
- **Manual tests**: Five manual test tasks documented in `docs/MANUAL_TESTING.md` per ROADMAP Step 3
- **No breaking changes**: Existing `read_file` tool and agent loop behavior are unchanged
