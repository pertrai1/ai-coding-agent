## MODIFIED Requirements

### Requirement: CLI entrypoint with commander
The project SHALL have a `src/cli.ts` entrypoint that uses `commander` to define the CLI program with `--help` and `--version` flags. The default action SHALL load config and project context, optionally resume a saved session when `--resume <sessionId>` is provided, then launch the interactive REPL chat loop with the resolved configuration.

#### Scenario: Default command starts a fresh session
- **WHEN** a user runs the CLI with no arguments
- **AND** `ANTHROPIC_API_KEY` is set in the environment
- **THEN** the CLI SHALL load config from all three scopes
- **AND** load `AGENTS.md` from the current working directory
- **AND** start a fresh REPL session

#### Scenario: Default command resumes a saved session
- **WHEN** a user runs the CLI with `--resume session_abc`
- **AND** `ANTHROPIC_API_KEY` is set in the environment
- **THEN** the CLI SHALL load config from all three scopes
- **AND** load `AGENTS.md` from the current working directory
- **AND** pass `session_abc` into REPL startup as a resume target

#### Scenario: Invalid resume target stops before REPL launch
- **WHEN** a user runs the CLI with `--resume session_missing`
- **AND** no saved transcript exists for that identifier
- **THEN** the CLI SHALL print an error
- **AND** exit without entering the REPL
