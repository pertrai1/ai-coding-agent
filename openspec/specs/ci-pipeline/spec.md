## ADDED Requirements

### Requirement: CI workflow file exists
The project SHALL have a GitHub Actions workflow at `.github/workflows/ci.yml` that triggers on push and pull request events.

#### Scenario: Workflow triggers on push
- **WHEN** a commit is pushed to any branch
- **THEN** the CI workflow runs

#### Scenario: Workflow triggers on pull request
- **WHEN** a pull request is opened or updated
- **THEN** the CI workflow runs

### Requirement: CI installs dependencies
The CI workflow SHALL include a step that installs project dependencies using `npm ci`.

#### Scenario: Dependencies install successfully
- **WHEN** the CI install step runs
- **THEN** all dependencies from `package-lock.json` are installed and the step exits with code 0

### Requirement: CI runs typecheck
The CI workflow SHALL include a step that runs `npm run typecheck` to verify type correctness.

#### Scenario: Typecheck passes in CI
- **WHEN** the CI typecheck step runs on a codebase with no type errors
- **THEN** the step exits with code 0

#### Scenario: Typecheck fails in CI
- **WHEN** the CI typecheck step runs on a codebase with type errors
- **THEN** the step exits with a non-zero code and the workflow fails

### Requirement: CI runs tests
The CI workflow SHALL include a step that runs `npm run test` to execute the test suite.

#### Scenario: Tests pass in CI
- **WHEN** the CI test step runs and all tests pass
- **THEN** the step exits with code 0

### Requirement: CI runs build
The CI workflow SHALL include a step that runs `npm run build` to compile the project.

#### Scenario: Build succeeds in CI
- **WHEN** the CI build step runs on a codebase with no compilation errors
- **THEN** the step exits with code 0

### Requirement: CI smoke check for --help
The CI workflow SHALL include a step that runs the compiled CLI with `--help` and verifies it exits successfully.

#### Scenario: CLI --help works after build
- **WHEN** the CI runs `node dist/cli.js --help`
- **THEN** the command prints usage information and exits with code 0

### Requirement: CI smoke check for --version
The CI workflow SHALL include a step that runs the compiled CLI with `--version` and verifies it exits successfully.

#### Scenario: CLI --version works after build
- **WHEN** the CI runs `node dist/cli.js --version`
- **THEN** the command prints the version string and exits with code 0
