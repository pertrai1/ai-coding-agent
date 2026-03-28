## MODIFIED Requirements

### Requirement: System prompt
The REPL SHALL assemble the system prompt dynamically from three sources in order: (1) the base coding assistant prompt, (2) `AGENTS.md` content wrapped in `<project-instructions>` delimiters if present, and (3) config-provided `systemPromptExtra` text if present. The assembled prompt SHALL be included in each API request.

#### Scenario: System prompt with all sources
- **WHEN** `AGENTS.md` content is available
- **AND** config `systemPromptExtra` is set to `"Always explain your reasoning."`
- **THEN** the system prompt sent to the API SHALL contain the base prompt, followed by project instructions in delimiters, followed by `"Always explain your reasoning."`

#### Scenario: System prompt with no project instructions or extra text
- **WHEN** no `AGENTS.md` was loaded
- **AND** no `systemPromptExtra` is configured
- **THEN** the system prompt SHALL be the base coding assistant prompt only

#### Scenario: System prompt with only AGENTS.md
- **WHEN** `AGENTS.md` content is available
- **AND** no `systemPromptExtra` is configured
- **THEN** the system prompt SHALL be the base prompt followed by project instructions in delimiters

### Requirement: Model from config
The REPL SHALL use the model specified in the resolved config. If no model is specified in config, the REPL SHALL fall back to the built-in default model.

#### Scenario: Config specifies model
- **WHEN** resolved config has `model: "claude-haiku-4-5-20250514"`
- **THEN** the REPL SHALL pass `"claude-haiku-4-5-20250514"` as the model to the agent loop

#### Scenario: No model in config
- **WHEN** resolved config has no `model` key
- **THEN** the REPL SHALL use the built-in default model `"claude-sonnet-4-20250514"`
