## Purpose

The `write_file` tool provides a mechanism for creating new files or overwriting existing ones with provided content. It includes support for creating nested directories automatically.

## Requirements

### Requirement: write_file tool definition
The `write_file` tool SHALL be registered with name `"write_file"`, a description indicating it creates or overwrites files with provided content, and an input schema requiring `filePath` (string) and `content` (string) properties.

#### Scenario: Tool definition is well-formed
- **WHEN** the tool registry is queried for all tool definitions
- **THEN** it includes a tool with `name: "write_file"`, a non-empty `description`, and `input_schema` with `properties.filePath` and `properties.content` both of type `string`, and `required: ["filePath", "content"]`

### Requirement: write_file validates inputs
The `write_file` tool SHALL validate that `filePath` is a non-empty string and `content` is a string (empty string is allowed for creating empty files). If validation fails, the tool SHALL return a `ToolResult` with `isError: true` and a descriptive message. The tool MUST NOT throw an exception.

#### Scenario: Missing filePath returns error
- **WHEN** `write_file` is called without a `filePath` property or with a non-string `filePath`
- **THEN** the tool returns a result with `isError: true` and content indicating that `filePath` is required and must be a string

#### Scenario: Missing content returns error
- **WHEN** `write_file` is called without a `content` property or with a non-string `content`
- **THEN** the tool returns a result with `isError: true` and content indicating that `content` is required and must be a string

#### Scenario: Empty content creates empty file
- **WHEN** `write_file` is called with `content` as an empty string
- **THEN** the tool creates the file with empty content (not an error)

### Requirement: write_file creates or overwrites files
The `write_file` tool SHALL write the provided `content` string to the file at `filePath`. If the file already exists, it SHALL be overwritten. If the file does not exist, it SHALL be created. The tool MUST use `node:fs/promises` for file access.

#### Scenario: New file is created
- **WHEN** `write_file` is called with `filePath` pointing to a path where no file exists
- **THEN** the tool creates the file with the provided content and returns a success result

#### Scenario: Existing file is overwritten
- **WHEN** `write_file` is called with `filePath` pointing to an existing file
- **THEN** the tool overwrites the file with the provided content and returns a success result

#### Scenario: Content is written exactly
- **WHEN** `write_file` is called with content containing specific text, whitespace, and line breaks
- **THEN** the file on disk contains exactly the provided content with no modifications

### Requirement: write_file creates parent directories
The `write_file` tool SHALL create any missing parent directories in the `filePath` using recursive directory creation before writing the file. This MUST be equivalent to `mkdir -p` behavior.

#### Scenario: Nested directories are created
- **WHEN** `write_file` is called with `filePath` of `"some/nested/dir/file.ts"` and the intermediate directories do not exist
- **THEN** the tool creates all necessary parent directories and writes the file successfully

#### Scenario: Existing parent directories are not affected
- **WHEN** `write_file` is called with `filePath` whose parent directories already exist
- **THEN** the existing directories are not modified and the file is written normally

### Requirement: write_file returns structured errors for file system failures
When the file cannot be written (e.g., permission denied, invalid path), the `write_file` tool SHALL return an error result with `isError: true` and a descriptive message. The tool MUST NOT throw an exception.

#### Scenario: Permission denied returns error
- **WHEN** `write_file` is called with `filePath` pointing to a location the process cannot write to
- **THEN** the tool returns a result with `isError: true` and content describing the permission error

#### Scenario: Writing to a directory path returns error
- **WHEN** `write_file` is called with `filePath` pointing to an existing directory
- **THEN** the tool returns a result with `isError: true` and content indicating the path is a directory
