## Purpose

AGENTS.md loading and system prompt injection with delimiters.

## Requirements

### Requirement: Load AGENTS.md from project root
The system SHALL attempt to read an `AGENTS.md` file from the current working directory at startup. If the file exists, its contents SHALL be stored for injection into the system prompt. If the file does not exist, the system SHALL continue without error.

#### Scenario: AGENTS.md exists and is loaded
- **WHEN** an `AGENTS.md` file exists in the current working directory
- **AND** the CLI starts
- **THEN** the file contents SHALL be read and stored for system prompt assembly

#### Scenario: AGENTS.md does not exist
- **WHEN** no `AGENTS.md` file exists in the current working directory
- **AND** the CLI starts
- **THEN** the system SHALL continue startup without error
- **AND** no project instructions SHALL be included in the system prompt

#### Scenario: AGENTS.md read error
- **WHEN** an `AGENTS.md` file exists but cannot be read (e.g., permission denied)
- **AND** the CLI starts
- **THEN** the system SHALL log a warning to stderr
- **AND** continue startup without project instructions

### Requirement: Inject project instructions into system prompt
When `AGENTS.md` content is available, the system SHALL include it in the system prompt wrapped in `<project-instructions>` delimiters, placed after the base system prompt and before any config-provided extra prompt text.

#### Scenario: Project instructions appear in system prompt
- **WHEN** `AGENTS.md` has been loaded with content `"Follow the coding standards."`
- **AND** a message is sent to the Anthropic API
- **THEN** the `system` field in the request SHALL contain the base prompt followed by `<project-instructions>\nFollow the coding standards.\n</project-instructions>`

#### Scenario: System prompt without project instructions
- **WHEN** no `AGENTS.md` was loaded
- **AND** a message is sent to the Anthropic API
- **THEN** the `system` field SHALL contain only the base prompt and any config extra prompt text, with no `<project-instructions>` block
