## MODIFIED Requirements

### Requirement: ANTHROPIC_API_KEY is read from environment
The CLI SHALL read `ANTHROPIC_API_KEY` from `process.env` at startup. When the default command (REPL) is invoked and the key is missing, the CLI SHALL print an error message and exit with code 1.

#### Scenario: API key is present
- **WHEN** `ANTHROPIC_API_KEY` is set in the environment
- **AND** the CLI starts the REPL
- **THEN** the CLI proceeds to launch the interactive chat loop

#### Scenario: API key is absent and REPL is launched
- **WHEN** `ANTHROPIC_API_KEY` is not set in the environment
- **AND** the CLI default command runs (REPL)
- **THEN** the CLI SHALL print an error message indicating the API key is required and exit with code 1

#### Scenario: API key is absent but --help is used
- **WHEN** `ANTHROPIC_API_KEY` is not set in the environment
- **AND** the user runs the CLI with `--help`
- **THEN** the CLI SHALL print help text and exit with code 0 without error

#### Scenario: API key is absent but --version is used
- **WHEN** `ANTHROPIC_API_KEY` is not set in the environment
- **AND** the user runs the CLI with `--version`
- **THEN** the CLI SHALL print the version and exit with code 0 without error

### Requirement: CLI entrypoint with commander
The project SHALL have a `src/cli.ts` entrypoint that uses `commander` to define the CLI program with `--help` and `--version` flags. The default action SHALL launch the interactive REPL chat loop.

#### Scenario: --help flag prints usage
- **WHEN** a user runs the CLI with `--help`
- **THEN** the CLI prints usage information to stdout and exits with code 0

#### Scenario: --version flag prints version
- **WHEN** a user runs the CLI with `--version`
- **THEN** the CLI prints the version from `package.json` to stdout and exits with code 0

#### Scenario: Default command launches REPL
- **WHEN** a user runs the CLI with no arguments
- **AND** `ANTHROPIC_API_KEY` is set in the environment
- **THEN** the CLI SHALL launch the interactive REPL chat loop
