## ADDED Requirements

### Requirement: Plan mode toggle command
The REPL SHALL support a `/plan` slash command that toggles plan mode on and off. `/plan` with no arguments activates plan mode. `/plan off` deactivates plan mode. The REPL SHALL track plan mode as a boolean state variable.

#### Scenario: Activating plan mode
- **WHEN** the user types `/plan` and presses Enter
- **THEN** plan mode SHALL be activated
- **AND** the REPL SHALL display a confirmation message indicating plan mode is active
- **AND** the REPL prompt SHALL change to `[plan] > `

#### Scenario: Deactivating plan mode
- **WHEN** the user types `/plan off` and presses Enter
- **THEN** plan mode SHALL be deactivated
- **AND** the REPL SHALL display a confirmation message indicating plan mode is off
- **AND** the REPL prompt SHALL revert to `> `

#### Scenario: Plan mode not active by default
- **WHEN** the REPL starts a new session
- **THEN** plan mode SHALL be off
- **AND** the REPL prompt SHALL be `> `

### Requirement: Plan mode denies mutating tools
When plan mode is active, the agent loop SHALL deny all mutating tool calls (`write_file`, `edit_file`, `bash`) regardless of their configured permission. The denial SHALL use the same structured error format as the existing deny-mode logic. Read-only tools (`read_file`, `glob`, `grep`) and the `subagent` tool SHALL remain functional.

#### Scenario: Write file denied in plan mode
- **WHEN** plan mode is active
- **AND** the model requests `write_file`
- **THEN** the tool call SHALL be denied with `isError: true`
- **AND** the content SHALL indicate the tool was denied because plan mode is active
- **AND** the tool SHALL NOT execute

#### Scenario: Edit file denied in plan mode
- **WHEN** plan mode is active
- **AND** the model requests `edit_file`
- **THEN** the tool call SHALL be denied with `isError: true`
- **AND** the content SHALL indicate the tool was denied because plan mode is active
- **AND** the tool SHALL NOT execute

#### Scenario: Bash denied in plan mode
- **WHEN** plan mode is active
- **AND** the model requests `bash`
- **THEN** the tool call SHALL be denied with `isError: true`
- **AND** the content SHALL indicate the tool was denied because plan mode is active
- **AND** the tool SHALL NOT execute

#### Scenario: Read-only tools work in plan mode
- **WHEN** plan mode is active
- **AND** the model requests `read_file`
- **THEN** the tool SHALL execute normally and return its result to the model

#### Scenario: Subagent tool works in plan mode
- **WHEN** plan mode is active
- **AND** the model requests `subagent`
- **THEN** the tool SHALL execute normally and return its result to the model

### Requirement: Planner-oriented system prompt
When plan mode is active, the system prompt SHALL include an additional section appended after the normal system prompt. This section SHALL instruct the model to act as an architect: analyze the codebase, ask clarifying questions, and produce ordered actionable steps. It SHALL explicitly instruct the model NOT to make any code changes.

#### Scenario: System prompt includes planner section
- **WHEN** plan mode is active
- **AND** a message is sent to the Anthropic API
- **THEN** the `system` field SHALL contain the normal system prompt followed by a planner-mode appendix

#### Scenario: System prompt without planner section
- **WHEN** plan mode is not active
- **AND** a message is sent to the Anthropic API
- **THEN** the `system` field SHALL NOT contain the planner-mode appendix

### Requirement: Plan approval flow
When plan mode is active and the agent loop completes a response (model returns text without requesting tools), the REPL SHALL prompt the user to approve the plan. The prompt SHALL offer three options: approve (`y`), reject (`n`), or provide modifications (any other text).

#### Scenario: User approves plan
- **WHEN** plan mode is active
- **AND** the agent loop returns a text response
- **AND** the user responds to the approval prompt with `y`
- **THEN** plan mode SHALL be deactivated
- **AND** the REPL prompt SHALL revert to `> `
- **AND** the user's approval SHALL be appended to conversation history as a user message instructing the agent to execute the plan

#### Scenario: User rejects plan
- **WHEN** plan mode is active
- **AND** the agent loop returns a text response
- **AND** the user responds to the approval prompt with `n`
- **THEN** plan mode SHALL remain active
- **AND** a rejection message SHALL be appended to conversation history as a user message

#### Scenario: User provides plan modifications
- **WHEN** plan mode is active
- **AND** the agent loop returns a text response
- **AND** the user types feedback text (not `y` or `n`) at the approval prompt
- **THEN** plan mode SHALL remain active
- **AND** the user's feedback SHALL be appended to conversation history as a user message
- **AND** the agent SHALL revise its plan based on the feedback

### Requirement: Plan mode status in slash command output
The `/status` command SHALL indicate whether plan mode is active when displaying session information.

#### Scenario: Status shows plan mode active
- **WHEN** plan mode is active
- **AND** the user types `/status`
- **THEN** the output SHALL include an indication that plan mode is on

#### Scenario: Status shows plan mode inactive
- **WHEN** plan mode is not active
- **AND** the user types `/status`
- **THEN** the output SHALL NOT include a plan mode indication
