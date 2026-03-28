## MODIFIED Requirements

### Requirement: CLI entrypoint with commander
The project SHALL have a `src/cli.ts` entrypoint that uses `commander` to define the CLI program with `--help` and `--version` flags. The default action SHALL load config and project context, then launch the interactive REPL chat loop with the resolved configuration.

#### Scenario: --help flag prints usage
- **WHEN** a user runs the CLI with `--help`
- **THEN** the CLI prints usage information to stdout and exits with code 0

#### Scenario: --version flag prints version
- **WHEN** a user runs the CLI with `--version`
- **THEN** the CLI prints the version from `package.json` to stdout and exits with code 0

#### Scenario: Default command loads config then launches REPL
- **WHEN** a user runs the CLI with no arguments
- **AND** `ANTHROPIC_API_KEY` is set in the environment
- **THEN** the CLI SHALL load config from all three scopes
- **AND** load `AGENTS.md` from the current working directory
- **AND** pass the resolved config to the REPL startup function
