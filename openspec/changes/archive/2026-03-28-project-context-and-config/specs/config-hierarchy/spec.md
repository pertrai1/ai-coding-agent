## ADDED Requirements

### Requirement: Three-tier config file discovery
The system SHALL look for config files at three scopes in this order: global (`~/.config/ai-agent/config.json`), project (`<cwd>/.ai-agent/config.json`), and local (`<cwd>/.ai-agent/config.local.json`). Each file is optional.

#### Scenario: All three config files exist
- **WHEN** config files exist at global, project, and local paths
- **AND** the CLI starts
- **THEN** all three files SHALL be read and parsed

#### Scenario: No config files exist
- **WHEN** no config files exist at any of the three paths
- **AND** the CLI starts
- **THEN** the system SHALL use built-in defaults without error

#### Scenario: Only project config exists
- **WHEN** only `<cwd>/.ai-agent/config.json` exists
- **AND** the CLI starts
- **THEN** only the project config SHALL be loaded and applied over built-in defaults

### Requirement: Config file format
Each config file SHALL be a JSON file with the following optional keys: `model` (string), `systemPromptExtra` (string), and `permissions` (object mapping tool names to `"allow"`, `"prompt"`, or `"deny"`).

#### Scenario: Valid config with all keys
- **WHEN** a config file contains `{ "model": "claude-haiku-4-5-20250514", "systemPromptExtra": "Be brief.", "permissions": { "bash": "deny" } }`
- **THEN** the system SHALL parse all three keys successfully

#### Scenario: Config with only model key
- **WHEN** a config file contains `{ "model": "claude-haiku-4-5-20250514" }`
- **THEN** the system SHALL apply the model value and leave other settings at defaults

#### Scenario: Config with unknown keys
- **WHEN** a config file contains `{ "model": "claude-haiku-4-5-20250514", "unknownKey": true }`
- **THEN** the system SHALL parse the known `model` key and silently ignore `unknownKey`

### Requirement: Config merge order
The system SHALL merge config values in the order global < project < local, where later scopes override earlier scopes. Scalar values use last-writer-wins. The `permissions` object SHALL be shallow-merged, where each tool name key in a later scope overrides that same key from an earlier scope.

#### Scenario: Local overrides global model
- **WHEN** global config has `{ "model": "claude-sonnet-4-20250514" }`
- **AND** local config has `{ "model": "claude-haiku-4-5-20250514" }`
- **THEN** the resolved model SHALL be `"claude-haiku-4-5-20250514"`

#### Scenario: Permissions merge across scopes
- **WHEN** global config has `{ "permissions": { "bash": "deny", "write_file": "prompt" } }`
- **AND** project config has `{ "permissions": { "bash": "prompt" } }`
- **THEN** resolved permissions SHALL be `{ "bash": "prompt", "write_file": "prompt" }`

#### Scenario: Unset keys preserve earlier values
- **WHEN** global config has `{ "model": "claude-sonnet-4-20250514", "systemPromptExtra": "Be helpful." }`
- **AND** project config has `{ "model": "claude-haiku-4-5-20250514" }`
- **THEN** resolved config SHALL have model `"claude-haiku-4-5-20250514"` and systemPromptExtra `"Be helpful."`

### Requirement: Invalid config handling
When a config file contains invalid JSON, the system SHALL log a warning to stderr and skip that scope. When a `permissions` value is not one of `"allow"`, `"prompt"`, or `"deny"`, the system SHALL log a warning and skip that specific permission entry.

#### Scenario: Malformed JSON in one config file
- **WHEN** the project config file contains invalid JSON
- **AND** global and local config files are valid
- **THEN** the system SHALL log a warning about the project config
- **AND** merge only global and local configs

#### Scenario: Invalid permission value
- **WHEN** a config file contains `{ "permissions": { "bash": "always" } }`
- **THEN** the system SHALL log a warning about the invalid value `"always"` for `"bash"`
- **AND** skip that permission entry, leaving bash at its default
