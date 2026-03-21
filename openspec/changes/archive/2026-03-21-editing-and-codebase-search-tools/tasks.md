## 1. write_file Tool

- [x] 1.1 Create `src/tools/write-file.ts` exporting `writeFileTool: ToolRegistration` with tool name `"write_file"`, description, and input schema requiring `filePath` and `content` string properties
- [x] 1.2 Implement `execute` function with input validation: check `filePath` is non-empty string and `content` is a string (empty allowed), returning `{ content, isError: true }` on invalid input
- [x] 1.3 Implement file writing logic: `mkdir(dirname(filePath), { recursive: true })` then `writeFile(filePath, content, "utf-8")`, returning success message with file path
- [x] 1.4 Add error handling: catch EACCES, EISDIR, and generic errors, returning structured `{ content, isError: true }` results matching read_file pattern
- [x] 1.5 Add unit tests in `src/__tests__/write-file.test.ts`: new file creation, overwrite existing, empty content, nested directory auto-creation, missing filePath validation, permission error

## 2. edit_file Tool

- [x] 2.1 Create `src/tools/edit-file.ts` exporting `editFileTool: ToolRegistration` with tool name `"edit_file"`, description, and input schema requiring `filePath`, `findText`, and `replaceText` string properties
- [x] 2.2 Implement `execute` function with input validation: check `filePath` and `findText` are non-empty strings, `replaceText` is a string (empty allowed for deletion), returning `{ content, isError: true }` on invalid input
- [x] 2.3 Implement unique-match replacement logic: read file, count occurrences of `findText`, error on 0 matches ("text not found"), error on 2+ matches ("multiple matches found — provide more surrounding context"), replace on exactly 1 match, write back
- [x] 2.4 Add error handling: catch ENOENT, EACCES, EISDIR, and generic errors, returning structured `{ content, isError: true }` results
- [x] 2.5 Add unit tests in `src/__tests__/edit-file.test.ts`: successful replacement, text not found, multiple matches error, empty replaceText (deletion), missing/invalid inputs, file not found, preserves surrounding content

## 3. glob Tool

- [x] 3.1 Create `src/tools/glob.ts` exporting `globTool: ToolRegistration` with tool name `"glob"`, description, and input schema requiring `pattern` string with optional `path` string
- [x] 3.2 Implement `execute` function with input validation: check `pattern` is non-empty string, `path` is string if provided, returning `{ content, isError: true }` on invalid input
- [x] 3.3 Implement glob logic using `glob` from `node:fs/promises` with `cwd` set to `path` or `process.cwd()`, collect results into newline-separated string, return "No files matched" message for empty results
- [x] 3.4 Add error handling: catch non-existent directory and generic errors, returning structured `{ content, isError: true }` results
- [x] 3.5 Add unit tests in `src/__tests__/glob.test.ts`: pattern matching files, no matches, custom base path, missing pattern validation, non-existent directory error

## 4. grep Tool

- [x] 4.1 Create `src/tools/grep.ts` exporting `grepTool: ToolRegistration` with tool name `"grep"`, description, and input schema requiring `pattern` string with optional `path` and `include` string properties
- [x] 4.2 Implement `execute` function with input validation: check `pattern` is non-empty string, `path` and `include` are strings if provided, returning `{ content, isError: true }` on invalid input
- [x] 4.3 Implement pattern matching: attempt `new RegExp(pattern)`, fall back to `String.includes()` if regex is invalid
- [x] 4.4 Implement file search: if `path` is a file, search it directly; if directory, use `glob('**/*', { cwd: path })` to find files (filtered by `include` pattern if provided), read each file, match lines, format as `filePath:lineNumber:lineContent`
- [x] 4.5 Add error handling: catch ENOENT for non-existent path, skip unreadable files in directory search, return structured `{ content, isError: true }` results for top-level errors
- [x] 4.6 Add unit tests in `src/__tests__/grep.test.ts`: single file match, multi-file match, no matches, 1-based line numbers, include filter, regex pattern, invalid regex fallback, non-existent path error, unreadable file skipping

## 5. Tool Registration

- [x] 5.1 Import `editFileTool`, `writeFileTool`, `globTool`, `grepTool` in `src/tools/index.ts` and add `registry.register()` calls for each alongside existing `readFileTool`
- [x] 5.2 Add unit test in `src/__tests__/tools.test.ts` verifying `createToolRegistry()` returns definitions for all 5 tools: `read_file`, `edit_file`, `write_file`, `glob`, `grep`

## 6. Manual Tests and Documentation

- [x] 6.1 Add manual test in `docs/MANUAL_TESTING.md`: edit an existing function comment using the agent (covers ROADMAP: "edits an existing function comment")
- [x] 6.2 Add manual test in `docs/MANUAL_TESTING.md`: create a brand-new file using the agent (covers ROADMAP: "creates a brand-new file")
- [x] 6.3 Add manual test in `docs/MANUAL_TESTING.md`: use `glob` to list language-specific files (covers ROADMAP: "uses glob to list language-specific files")
- [x] 6.4 Add manual test in `docs/MANUAL_TESTING.md`: use `grep` to find symbol usage with line numbers (covers ROADMAP: "uses grep to find symbol usage with line numbers")
- [x] 6.5 Add manual test in `docs/MANUAL_TESTING.md`: refactor a symbol via search + multi-file edits (covers ROADMAP: "refactors a symbol via search + multi-file edits")
- [x] 6.6 Mark all Step 3 ROADMAP items as complete after manual tests pass
