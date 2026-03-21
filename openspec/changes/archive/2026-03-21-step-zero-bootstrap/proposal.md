## Why

The AI coding agent project exists only as documentation (REQUIREMENTS.md, ROADMAP.md). Before any feature work can begin, the project needs a working TypeScript Node.js scaffold with dependency management, build tooling, a CLI entrypoint, and CI. Without this foundation, nothing else in the roadmap is buildable.

## What Changes

- Initialize a Node.js project with `package.json` and TypeScript compilation via `tsconfig.json`.
- Install core runtime dependencies: `commander` (CLI parsing), `chalk` (terminal styling), `dotenv` (.env loading).
- Create a `src/cli.ts` entrypoint that boots the CLI, reads `ANTHROPIC_API_KEY` from the environment, and exposes `--help` and `--version` flags.
- Add `dev`, `build`, `typecheck`, and `test` npm scripts.
- Add a `curl`-based script or doc snippet to verify Anthropic API connectivity.
- Create a small `playground/` directory with sample files for future tool testing.
- Create a GitHub Actions CI workflow (`.github/workflows/ci.yml`) with steps for install, typecheck, test, build, and CLI smoke checks (`--help`, `--version`).

## Capabilities

### New Capabilities

- `cli-bootstrap`: Project manifest, TypeScript config, dependency installation, and the core `src/cli.ts` entrypoint with environment variable loading and basic CLI flags.
- `ci-pipeline`: GitHub Actions workflow that runs install, typecheck, test, build, and CLI smoke checks on every push/PR.

### Modified Capabilities

<!-- None - this is the first change in a greenfield project. -->

## Impact

- **Code**: Creates `package.json`, `tsconfig.json`, `src/cli.ts`, and supporting config files from scratch.
- **Dependencies**: Adds `commander`, `chalk`, `dotenv` as runtime deps; `typescript`, `vitest`, `tsx`, and type packages as dev deps.
- **CI**: Adds `.github/workflows/ci.yml` — all future changes will run through this pipeline.
- **Playground**: Creates `playground/` with sample files used by later steps for tool integration testing.
