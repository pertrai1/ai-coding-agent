## Purpose

The `glob` tool provides a mechanism for finding files matching a glob pattern within the filesystem. It enables the agent to discover relevant files for subsequent operations.

## Requirements

### Requirement: glob tool definition
The `glob` tool SHALL be registered with name `"glob"`, a description indicating it finds files matching a glob pattern, and an input schema requiring a `pattern` (string) property and an optional `path` (string) property for the base directory.

#### Scenario: Tool definition is well-formed
- **WHEN** the tool registry is queried for all tool definitions
- **THEN** it includes a tool with `name: "glob"`, a non-empty `description`, and `input_schema` with `properties.pattern` of type `string` in `required: ["pattern"]`, and `properties.path` of type `string` as optional

### Requirement: glob validates inputs
The `glob` tool SHALL validate that `pattern` is a non-empty string. If `path` is provided, it MUST also be a string. If validation fails, the tool SHALL return a `ToolResult` with `isError: true` and a descriptive message. The tool MUST NOT throw an exception.

#### Scenario: Missing pattern returns error
- **WHEN** `glob` is called without a `pattern` property or with a non-string `pattern`
- **THEN** the tool returns a result with `isError: true` and content indicating that `pattern` is required and must be a string

#### Scenario: Empty pattern returns error
- **WHEN** `glob` is called with `pattern` as an empty string
- **THEN** the tool returns a result with `isError: true` and content indicating that `pattern` must not be empty

#### Scenario: Invalid path type returns error
- **WHEN** `glob` is called with `path` set to a non-string value
- **THEN** the tool returns a result with `isError: true` and content indicating that `path` must be a string

### Requirement: glob returns matching file paths
The `glob` tool SHALL use the Node.js built-in `glob` from `node:fs/promises` to find files matching the given `pattern`. The results SHALL be returned as a newline-separated list of file paths in the `content` string. If `path` is provided, it SHALL be used as the working directory (`cwd`) for the glob operation. If `path` is omitted, the current working directory SHALL be used.

#### Scenario: Pattern matches files
- **WHEN** `glob` is called with `pattern: "**/*.ts"` in a directory containing TypeScript files
- **THEN** the tool returns a newline-separated list of matching file paths

#### Scenario: Pattern matches no files
- **WHEN** `glob` is called with a pattern that matches no files
- **THEN** the tool returns a success result with content indicating no files matched (not an error)

#### Scenario: Custom base path is used
- **WHEN** `glob` is called with `pattern: "*.ts"` and `path: "src/tools"`
- **THEN** the tool searches within the `src/tools` directory and returns matching paths

#### Scenario: Default base path is current directory
- **WHEN** `glob` is called with only a `pattern` and no `path`
- **THEN** the tool searches from the current working directory

### Requirement: glob returns structured errors for failures
When the glob operation fails (e.g., invalid pattern, inaccessible directory), the tool SHALL return an error result with `isError: true` and a descriptive message. The tool MUST NOT throw an exception.

#### Scenario: Non-existent base path returns error
- **WHEN** `glob` is called with `path` pointing to a directory that does not exist
- **THEN** the tool returns a result with `isError: true` and content indicating the directory was not found

#### Scenario: Unexpected error returns structured error
- **WHEN** the glob operation throws an unexpected error
- **THEN** the tool catches the error and returns a result with `isError: true` and a descriptive error message
