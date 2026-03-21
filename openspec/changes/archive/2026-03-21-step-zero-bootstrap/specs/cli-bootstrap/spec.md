## ADDED Requirements

### Requirement: Project manifest exists
The project SHALL have a `package.json` with a valid `name`, `version`, `description`, and `type` field set to `"module"` for ESM support.

#### Scenario: Package manifest is valid JSON
- **WHEN** a developer clones the repository and runs `cat package.json`
- **THEN** the file is valid JSON containing `name`, `version`, `description`, and `"type": "module"`

### Requirement: TypeScript compilation is configured
The project SHALL have a `tsconfig.json` that targets Node.js with ESM module resolution, strict type checking enabled, and output directed to a `dist/` directory.

#### Scenario: TypeScript config compiles src to dist
- **WHEN** a developer runs `npx tsc --noEmit`
- **THEN** the command exits with code 0 and no type errors are reported

#### Scenario: Build output lands in dist directory
- **WHEN** a developer runs `npm run build`
- **THEN** compiled JavaScript files appear in the `dist/` directory

### Requirement: Environment variable loading
The CLI SHALL load variables from a `.env` file in the project root at startup using `dotenv`, before any other initialization occurs.

#### Scenario: .env file is loaded
- **WHEN** a `.env` file exists with `ANTHROPIC_API_KEY=test-key-123`
- **AND** the CLI starts
- **THEN** `process.env.ANTHROPIC_API_KEY` equals `"test-key-123"`

#### Scenario: Missing .env file does not crash
- **WHEN** no `.env` file exists
- **AND** the CLI starts
- **THEN** the CLI starts without error

### Requirement: ANTHROPIC_API_KEY is read from environment
The CLI SHALL read `ANTHROPIC_API_KEY` from `process.env` at startup. The key is not validated or used in this step — only read and acknowledged.

#### Scenario: API key is present
- **WHEN** `ANTHROPIC_API_KEY` is set in the environment
- **AND** the CLI starts
- **THEN** the CLI proceeds without warning about a missing key

#### Scenario: API key is absent
- **WHEN** `ANTHROPIC_API_KEY` is not set in the environment
- **AND** the CLI starts in a mode that would need the key (future steps)
- **THEN** the CLI MAY warn that no API key is configured (non-blocking for this step)

### Requirement: CLI entrypoint with commander
The project SHALL have a `src/cli.ts` entrypoint that uses `commander` to define the CLI program with `--help` and `--version` flags.

#### Scenario: --help flag prints usage
- **WHEN** a user runs the CLI with `--help`
- **THEN** the CLI prints usage information to stdout and exits with code 0

#### Scenario: --version flag prints version
- **WHEN** a user runs the CLI with `--version`
- **THEN** the CLI prints the version from `package.json` to stdout and exits with code 0

### Requirement: NPM scripts for development workflow
The `package.json` SHALL include the following scripts: `dev` (run with watch/reload), `build` (compile TypeScript), `typecheck` (type-check without emitting), and `test` (run unit tests).

#### Scenario: dev script runs the CLI in development mode
- **WHEN** a developer runs `npm run dev`
- **THEN** the CLI starts using `tsx` for fast TypeScript execution

#### Scenario: build script compiles TypeScript
- **WHEN** a developer runs `npm run build`
- **THEN** `tsc` compiles all source files to the `dist/` directory and exits with code 0

#### Scenario: typecheck script checks types without emitting
- **WHEN** a developer runs `npm run typecheck`
- **THEN** `tsc --noEmit` runs and exits with code 0 if no type errors exist

#### Scenario: test script runs unit tests
- **WHEN** a developer runs `npm run test`
- **THEN** `vitest` executes all test files and reports results

### Requirement: Anthropic API connectivity verification
The project SHALL include a curl command or script snippet that can be used to verify connectivity to the Anthropic API.

#### Scenario: Curl command verifies API access
- **WHEN** a developer runs the provided curl command with a valid `ANTHROPIC_API_KEY`
- **THEN** the Anthropic API returns a successful response confirming connectivity

### Requirement: Playground directory for tool testing
The project SHALL include a `playground/` directory containing a small set of sample files (at least 2-3 files across 1-2 subdirectories) for use as a test target in later steps.

#### Scenario: Playground exists with sample files
- **WHEN** a developer lists the `playground/` directory
- **THEN** at least 2 files exist across at least 1 subdirectory
