## Context

This is a greenfield TypeScript CLI project. The repository currently contains only documentation (`REQUIREMENTS.md`, `ROADMAP.md`, `README.md`). No code, no `package.json`, no build tooling exists yet. Every subsequent roadmap step depends on having a working project scaffold with compilation, testing, and CI in place.

The target runtime is Node.js (latest LTS). The CLI will eventually become an AI coding agent that calls the Anthropic API, but this step only establishes the foundation — no AI functionality is implemented here.

## Goals / Non-Goals

**Goals:**
- A working `npm install && npm run build` flow from zero.
- A `src/cli.ts` entrypoint that parses commands, loads `.env`, reads `ANTHROPIC_API_KEY`, and responds to `--help` and `--version`.
- NPM scripts for `dev` (watch mode), `build` (compile), `typecheck` (type-only check), and `test` (unit tests).
- GitHub Actions CI that gates PRs on typecheck, test, build, and CLI smoke checks.
- A `playground/` directory with sample files for tool testing in later steps.

**Non-Goals:**
- No REPL, no Anthropic API client, no streaming — those are Step 1.
- No tool system — that's Step 2+.
- No runtime logic beyond CLI flag parsing and env loading.
- No Docker, no deployment, no publishing to npm.

## Decisions

### 1. TypeScript compilation: `tsx` for dev, `tsc` for build

**Choice**: Use `tsx` (esbuild-based) for development (`dev` script) and raw `tsc` for production builds.

**Why over alternatives:**
- `ts-node` — slower startup, more configuration needed.
- `esbuild` standalone — no type checking; we still need `tsc` for that.
- `tsx` gives fast dev iteration; `tsc` gives reliable, type-checked output for CI and distribution.

### 2. Test framework: `vitest`

**Choice**: Use `vitest` for unit testing.

**Why over alternatives:**
- `jest` — requires extra TS transform config (`ts-jest` or `@swc/jest`). Vitest works with TypeScript natively.
- `node:test` — too barebones for a project that will grow significantly.
- Vitest is fast, zero-config with TypeScript, and has a familiar API.

### 3. Output target: ESM with Node 20+ target

**Choice**: Compile to ESM (`"module": "nodenext"`) targeting Node 20+.

**Why over alternatives:**
- CJS — increasingly deprecated in the ecosystem; many dependencies are ESM-only.
- Bundling (esbuild/rollup output) — unnecessary complexity for a CLI tool not published to npm.
- Native ESM keeps imports straightforward and aligns with modern Node.js conventions.

### 4. Environment loading: `dotenv`

**Choice**: Use `dotenv` to load `.env` files at startup.

**Why over alternatives:**
- Manual `process.env` only — no `.env` file support, poor DX.
- `dotenv` is minimal, widely understood, and does one thing well.

### 5. CI: Single GitHub Actions workflow with sequential steps

**Choice**: One `ci.yml` workflow with install → typecheck → test → build → smoke checks.

**Why over alternatives:**
- Parallel jobs — overkill for a small project; adds matrix complexity.
- Multiple workflows — harder to reason about; one workflow gives a single green/red signal.
- Sequential steps fail fast and are simple to debug.

## Risks / Trade-offs

- **[Risk] `tsx` version drift from `tsc` behavior** → Mitigation: `typecheck` script runs `tsc --noEmit` independently; type errors caught regardless of `tsx` runtime behavior.
- **[Risk] ESM compatibility issues with some dependencies** → Mitigation: Node 20+ has mature ESM support; `commander`, `chalk`, and `dotenv` all support ESM.
- **[Risk] `playground/` files accidentally committed with sensitive data in future steps** → Mitigation: Keep `playground/` simple and generic now; add `.gitignore` rules if generated artifacts appear later.
