## ADDED Requirements

### Requirement: Plan mode tool denial override
The agent loop SHALL accept an optional `isToolDenied` callback in its options. When provided, this callback receives a tool name and returns `true` if the tool SHALL be denied regardless of its configured permission. The callback check SHALL occur before the existing permission check — if `isToolDenied` returns `true`, the tool is denied immediately without consulting the permission system.

#### Scenario: isToolDenied callback denies a mutating tool
- **WHEN** the `isToolDenied` callback is provided
- **AND** the callback returns `true` for `write_file`
- **AND** the model requests `write_file` with permission `"prompt"`
- **THEN** the tool SHALL be denied immediately
- **AND** a structured denial result with `isError: true` SHALL be returned to the model
- **AND** the permission-based approval flow SHALL NOT be triggered

#### Scenario: isToolDenied callback allows a read-only tool
- **WHEN** the `isToolDenied` callback is provided
- **AND** the callback returns `false` for `read_file`
- **AND** the model requests `read_file` with permission `"allow"`
- **THEN** the tool SHALL execute normally via the existing permission flow

#### Scenario: isToolDenied callback not provided
- **WHEN** the `isToolDenied` callback is not provided in options
- **THEN** the agent loop SHALL use the existing permission-based flow for all tools without any additional denial checks

#### Scenario: Denied tool result includes plan mode context
- **WHEN** the `isToolDenied` callback denies a tool
- **THEN** the denial result SHALL include `isError: true`
- **AND** the content SHALL indicate the tool was denied and mention plan mode
