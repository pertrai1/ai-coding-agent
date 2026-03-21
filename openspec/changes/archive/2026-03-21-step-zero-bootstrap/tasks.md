## 1. Project Initialization

- [x] 1.1 Run `npm init -y` to create `package.json`, then set `name` to `ai-coding-agent`, `version` to `0.1.0`, `description`, and `"type": "module"`
- [x] 1.2 Create `tsconfig.json` targeting Node 20+ with `"module": "nodenext"`, `"moduleResolution": "nodenext"`, strict mode enabled, `outDir` set to `dist/`, and `rootDir` set to `src/`
- [x] 1.3 Install runtime dependencies: `commander`, `chalk`, `dotenv`
- [x] 1.4 Install dev dependencies: `typescript`, `tsx`, `vitest`, `@types/node`
- [x] 1.5 Add `.gitignore` entries for `node_modules/`, `dist/`, and `.env`

## 2. CLI Entrypoint

- [x] 2.1 Create `src/cli.ts` that imports `dotenv/config` to load `.env` at startup
- [x] 2.2 Configure `commander` program with name, description, and version read from `package.json`
- [x] 2.3 Parse `process.env.ANTHROPIC_API_KEY` at startup (read only, no validation logic beyond existence check)
- [x] 2.4 Add a default command or action that prints a startup message using `chalk`
- [x] 2.5 Call `program.parse()` to activate CLI argument handling

## 3. NPM Scripts

- [x] 3.1 Add `"dev": "tsx src/cli.ts"` script to `package.json`
- [x] 3.2 Add `"build": "tsc"` script to `package.json`
- [x] 3.3 Add `"typecheck": "tsc --noEmit"` script to `package.json`
- [x] 3.4 Add `"test": "vitest run"` script to `package.json`

## 4. API Connectivity Verification

- [x] 4.1 Create a `scripts/verify-api.sh` with a curl command that sends a basic prompt to the Anthropic Messages API using `$ANTHROPIC_API_KEY` and prints the response

## 5. Playground Directory

- [x] 5.1 Create `playground/` with at least 2-3 sample files across 1+ subdirectories (e.g., `playground/hello.ts`, `playground/utils/math.ts`, `playground/README.md`)

## 6. CI Pipeline

- [x] 6.1 Create `.github/workflows/ci.yml` with trigger on `push` and `pull_request`
- [x] 6.2 Add job step: checkout code using `actions/checkout`
- [x] 6.3 Add job step: setup Node.js using `actions/setup-node` with the project Node version
- [x] 6.4 Add job step: `npm ci` to install dependencies
- [x] 6.5 Add job step: `npm run typecheck`
- [x] 6.6 Add job step: `npm run test`
- [x] 6.7 Add job step: `npm run build`
- [x] 6.8 Add job step: `node dist/cli.js --help` smoke check
- [x] 6.9 Add job step: `node dist/cli.js --version` smoke check

## 7. Baseline Test

- [x] 7.1 Add a minimal test file (`src/__tests__/cli.test.ts` or similar) that verifies the test runner works (e.g., a trivial assertion)
