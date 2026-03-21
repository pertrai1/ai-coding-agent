## ADDED Requirements

### Requirement: read_file tool definition
The `read_file` tool SHALL be registered with name `"read_file"`, a description indicating it reads file contents from disk, and an input schema requiring a `filePath` property of type `string` with a description of the absolute or relative file path to read.

#### Scenario: Tool definition is well-formed
- **WHEN** the tool registry is queried for all tool definitions
- **THEN** it includes a tool with `name: "read_file"`, a non-empty `description`, and `input_schema` with `properties.filePath` of type `string` and `required: ["filePath"]`

### Requirement: read_file returns file contents
The `read_file` tool SHALL read the file at the given `filePath` and return its text content as a string. The tool MUST use `node:fs/promises` for file access.

#### Scenario: Existing file is read successfully
- **WHEN** `read_file` is called with `filePath` pointing to an existing readable file
- **THEN** the tool returns the full text content of that file as its result string

#### Scenario: File with multiple lines
- **WHEN** `read_file` is called with a file containing multiple lines of text
- **THEN** the returned string preserves all line breaks and whitespace exactly as they appear in the file

### Requirement: read_file returns structured errors for missing files
When the file at `filePath` does not exist, the `read_file` tool SHALL return an error result with `is_error: true` and a message that includes the file path and indicates the file was not found. The tool MUST NOT throw an exception — it SHALL return the error as a structured tool result.

#### Scenario: Non-existent file returns error
- **WHEN** `read_file` is called with `filePath` pointing to a file that does not exist
- **THEN** the tool returns a result with `is_error: true` and content containing the file path and "not found" or "does not exist"

#### Scenario: Error does not crash the agent
- **WHEN** `read_file` is called with a non-existent file path
- **THEN** the agent loop receives the error result, appends it to conversation history, and continues normally (the model can respond to the error)

### Requirement: read_file returns structured errors for unreadable files
When the file at `filePath` exists but cannot be read (e.g., permission denied), the `read_file` tool SHALL return an error result with `is_error: true` and a message describing the failure. The tool MUST NOT throw an exception.

#### Scenario: Permission denied returns error
- **WHEN** `read_file` is called with `filePath` pointing to a file the process cannot read
- **THEN** the tool returns a result with `is_error: true` and content describing the permission error

### Requirement: read_file handles edge cases gracefully
The `read_file` tool SHALL handle edge cases including empty files and binary files without crashing.

#### Scenario: Empty file returns empty string
- **WHEN** `read_file` is called with `filePath` pointing to an existing but empty file
- **THEN** the tool returns an empty string as its result (not an error)

#### Scenario: Directory path returns error
- **WHEN** `read_file` is called with `filePath` pointing to a directory instead of a file
- **THEN** the tool returns a result with `is_error: true` and content indicating the path is a directory, not a file
