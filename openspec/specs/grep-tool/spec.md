## Purpose

The `grep` tool provides a mechanism for searching file contents for a pattern and returning matching lines with file paths and line numbers. It enables the agent to find relevant code sections across the filesystem.

## Requirements

### Requirement: grep tool definition
The `grep` tool SHALL be registered with name `"grep"`, a description indicating it searches file contents for a pattern and returns matching lines with file paths and line numbers, and an input schema requiring a `pattern` (string) property, with optional `path` (string) and `include` (string) properties.

#### Scenario: Tool definition is well-formed
- **WHEN** the tool registry is queried for all tool definitions
- **THEN** it includes a tool with `name: "grep"`, a non-empty `description`, and `input_schema` with `properties.pattern` of type `string` in `required: ["pattern"]`, and optional `properties.path` and `properties.include` of type `string`

### Requirement: grep validates inputs
The `grep` tool SHALL validate that `pattern` is a non-empty string. If `path` or `include` are provided, they MUST also be strings. If validation fails, the tool SHALL return a `ToolResult` with `isError: true` and a descriptive message. The tool MUST NOT throw an exception.

#### Scenario: Missing pattern returns error
- **WHEN** `grep` is called without a `pattern` property or with a non-string `pattern`
- **THEN** the tool returns a result with `isError: true` and content indicating that `pattern` is required and must be a string

#### Scenario: Empty pattern returns error
- **WHEN** `grep` is called with `pattern` as an empty string
- **THEN** the tool returns a result with `isError: true` and content indicating that `pattern` must not be empty

### Requirement: grep searches file contents and returns matches with location
The `grep` tool SHALL search file contents for the given `pattern` and return matching lines formatted as `filePath:lineNumber:lineContent`, one per line. Line numbers SHALL be 1-based. The tool MUST use `node:fs/promises` for file access.

#### Scenario: Pattern matches lines in a single file
- **WHEN** `grep` is called with `pattern: "TODO"` and `path` pointing to a file containing "TODO" on lines 3 and 7
- **THEN** the tool returns content with two lines formatted as `<filePath>:3:<line3Content>` and `<filePath>:7:<line7Content>`

#### Scenario: Pattern matches across multiple files
- **WHEN** `grep` is called with `pattern: "import"` and `path` pointing to a directory containing multiple files with "import" statements
- **THEN** the tool returns matches from all files, each formatted as `filePath:lineNumber:lineContent`

#### Scenario: No matches returns success with message
- **WHEN** `grep` is called with a pattern that does not appear in any searched files
- **THEN** the tool returns a success result with content indicating no matches were found (not an error)

#### Scenario: Line numbers are 1-based
- **WHEN** `grep` matches text on the first line of a file
- **THEN** the line number in the result is `1`, not `0`

### Requirement: grep supports directory and file path targets
The `grep` tool SHALL accept a `path` parameter. If `path` is a file, the tool searches only that file. If `path` is a directory, the tool recursively searches all files in that directory. If `path` is omitted, the tool searches from the current working directory.

#### Scenario: Single file search
- **WHEN** `grep` is called with `path` pointing to a single file
- **THEN** the tool searches only that file for the pattern

#### Scenario: Directory recursive search
- **WHEN** `grep` is called with `path` pointing to a directory
- **THEN** the tool recursively searches all files within that directory

#### Scenario: Default path is current directory
- **WHEN** `grep` is called without a `path` parameter
- **THEN** the tool searches from the current working directory

### Requirement: grep supports file type filtering
The `grep` tool SHALL accept an optional `include` parameter (a glob pattern like `"*.ts"`) that filters which files are searched when searching a directory. Only files matching the `include` pattern SHALL be searched.

#### Scenario: Include filter limits searched files
- **WHEN** `grep` is called with `include: "*.ts"` on a directory containing `.ts` and `.js` files
- **THEN** the tool only searches `.ts` files and returns matches only from those files

#### Scenario: No include searches all files
- **WHEN** `grep` is called on a directory without an `include` parameter
- **THEN** the tool searches all files in the directory

### Requirement: grep supports pattern matching
The `grep` tool SHALL attempt to interpret the `pattern` as a regular expression. If the pattern is not a valid regular expression, the tool SHALL fall back to literal string matching using `String.includes()`.

#### Scenario: Valid regex pattern is used
- **WHEN** `grep` is called with `pattern: "function\\s+\\w+"` (a valid regex)
- **THEN** the tool uses the regex to match lines

#### Scenario: Invalid regex falls back to literal match
- **WHEN** `grep` is called with `pattern: "foo[bar"` (invalid regex due to unclosed bracket)
- **THEN** the tool falls back to literal string matching and searches for the exact text `"foo[bar"`

### Requirement: grep returns structured errors for failures
When the grep operation encounters file system errors, the tool SHALL return an error result with `isError: true` and a descriptive message. The tool MUST NOT throw an exception. Errors reading individual files during a directory search SHALL be skipped silently (the tool continues searching other files).

#### Scenario: Non-existent path returns error
- **WHEN** `grep` is called with `path` pointing to a file or directory that does not exist
- **THEN** the tool returns a result with `isError: true` and content indicating the path was not found

#### Scenario: Unreadable files in directory are skipped
- **WHEN** `grep` searches a directory containing some files that cannot be read (e.g., binary files, permission denied)
- **THEN** the tool skips those files and continues searching the remaining files without returning an error
