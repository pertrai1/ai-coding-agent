## ADDED Requirements

### Requirement: edit_file tool definition
The `edit_file` tool SHALL be registered with name `"edit_file"`, a description indicating it performs targeted find-and-replace edits within existing files, and an input schema requiring `filePath` (string), `findText` (string), and `replaceText` (string) properties.

#### Scenario: Tool definition is well-formed
- **WHEN** the tool registry is queried for all tool definitions
- **THEN** it includes a tool with `name: "edit_file"`, a non-empty `description`, and `input_schema` with `properties.filePath`, `properties.findText`, and `properties.replaceText` all of type `string`, and `required: ["filePath", "findText", "replaceText"]`

### Requirement: edit_file validates inputs
The `edit_file` tool SHALL validate that `filePath`, `findText`, and `replaceText` are all present and are non-empty strings (except `replaceText` which MAY be an empty string to support deletion). If validation fails, the tool SHALL return a `ToolResult` with `isError: true` and a descriptive message. The tool MUST NOT throw an exception.

#### Scenario: Missing filePath returns error
- **WHEN** `edit_file` is called without a `filePath` property or with a non-string `filePath`
- **THEN** the tool returns `{ content: "Error: filePath is required and must be a string.", isError: true }`

#### Scenario: Missing findText returns error
- **WHEN** `edit_file` is called without a `findText` property or with a non-string `findText`
- **THEN** the tool returns a result with `isError: true` and content indicating that `findText` is required

#### Scenario: Empty findText returns error
- **WHEN** `edit_file` is called with `findText` as an empty string
- **THEN** the tool returns a result with `isError: true` and content indicating that `findText` must not be empty

#### Scenario: Empty replaceText is allowed
- **WHEN** `edit_file` is called with `replaceText` as an empty string and all other inputs valid
- **THEN** the tool proceeds with the edit (effectively deleting the matched text)

### Requirement: edit_file performs targeted replacement
The `edit_file` tool SHALL read the file at `filePath`, locate the exact occurrence of `findText` in the file content, replace it with `replaceText`, and write the modified content back to disk. The tool MUST use `node:fs/promises` for file access.

#### Scenario: Successful single replacement
- **WHEN** `edit_file` is called with `filePath` pointing to an existing file, and `findText` matches exactly one location in the file
- **THEN** the tool replaces `findText` with `replaceText`, writes the file, and returns a success result describing the change

#### Scenario: Replacement preserves surrounding content
- **WHEN** `edit_file` replaces text in the middle of a file
- **THEN** all content before and after the replaced text remains unchanged, including whitespace and line breaks

### Requirement: edit_file requires unique match
The `edit_file` tool SHALL require that `findText` matches exactly one location in the file. If `findText` is not found, the tool SHALL return an error. If `findText` matches more than one location, the tool SHALL return an error instructing the caller to provide more surrounding context to uniquely identify the edit location. The tool MUST NOT modify the file in either error case.

#### Scenario: Text not found returns error
- **WHEN** `edit_file` is called with `findText` that does not appear anywhere in the file
- **THEN** the tool returns a result with `isError: true` and content indicating the text was not found in the file

#### Scenario: Multiple matches returns error
- **WHEN** `edit_file` is called with `findText` that appears more than once in the file
- **THEN** the tool returns a result with `isError: true` and content indicating multiple matches were found and instructing the caller to provide more surrounding context

#### Scenario: File is not modified on error
- **WHEN** `edit_file` encounters a no-match or multiple-match error
- **THEN** the file on disk remains unchanged from its state before the tool was called

### Requirement: edit_file returns structured errors for file system failures
When the file at `filePath` does not exist, cannot be read, or cannot be written, the `edit_file` tool SHALL return an error result with `isError: true` and a descriptive message. The tool MUST NOT throw an exception.

#### Scenario: Non-existent file returns error
- **WHEN** `edit_file` is called with `filePath` pointing to a file that does not exist
- **THEN** the tool returns a result with `isError: true` and content containing the file path and indicating the file was not found

#### Scenario: Permission denied returns error
- **WHEN** `edit_file` is called with `filePath` pointing to a file the process cannot read or write
- **THEN** the tool returns a result with `isError: true` and content describing the permission error

#### Scenario: Directory path returns error
- **WHEN** `edit_file` is called with `filePath` pointing to a directory instead of a file
- **THEN** the tool returns a result with `isError: true` and content indicating the path is a directory, not a file
