## 1. Config Module Foundation

- [x] 1.1 Create `src/config/types.ts` with `Config` and `ResolvedConfig` type definitions
- [x] 1.2 Create `src/config/loader.ts` with `loadConfigFile(path): Config | null` that reads and parses a single JSON config file, returning null on missing file and logging a warning on parse errors
- [x] 1.3 Create `src/config/merge.ts` with `mergeConfigs(configs: (Config | null)[]): Config` that shallow-merges scalar values (last-writer-wins) and shallow-merges the `permissions` object
- [x] 1.4 Create `src/config/index.ts` with `loadConfig(): ResolvedConfig` that discovers all three config file paths (global, project, local), loads each via `loadConfigFile`, merges them, and validates permission values (warning and skipping invalid ones)
- [x] 1.5 Add unit tests for `loadConfigFile` — valid JSON, missing file, malformed JSON, permission-only config
- [x] 1.6 Add unit tests for `mergeConfigs` — empty array, single config, three-tier override for scalars and permissions
- [x] 1.7 Add unit tests for `loadConfig` — no config files present returns defaults, invalid permission value logged and skipped

## 2. Project Context Loading

- [x] 2.1 Create `src/config/context.ts` with `loadProjectInstructions(cwd: string): string | null` that reads `AGENTS.md` from the given directory, returning null if the file doesn't exist and logging a warning on read errors
- [x] 2.2 Create `assembleSystemPrompt(base: string, projectInstructions: string | null, extraPrompt: string | undefined): string` in `src/config/context.ts` that concatenates the base prompt, optional `<project-instructions>` wrapped content, and optional extra prompt text
- [x] 2.3 Add unit tests for `loadProjectInstructions` — file exists, file missing, file unreadable
- [x] 2.4 Add unit tests for `assembleSystemPrompt` — all three sources present, only base prompt, base + AGENTS.md only, base + extra only

## 3. Tool Permission Overrides

- [x] 3.1 Update `createToolRegistry()` in `src/tools/index.ts` to accept an optional `permissionOverrides: Record<string, ToolPermission>` parameter
- [x] 3.2 After registering all tools, apply overrides by iterating the overrides map and updating the `permission` field on matching registered tools (silently skip unknown tool names)
- [x] 3.3 Add unit tests for `createToolRegistry` with overrides — override bash to allow, override to deny, unknown tool ignored, no overrides preserves defaults

## 4. Startup Integration

- [x] 4.1 Update `startRepl` signature in `src/repl.ts` to accept `ResolvedConfig` as a second parameter instead of using hardcoded model and system prompt constants
- [x] 4.2 Wire `ResolvedConfig.model` (with fallback to default) into the agent loop `model` parameter
- [x] 4.3 Wire assembled system prompt (from `assembleSystemPrompt`) into the agent loop `system` parameter
- [x] 4.4 Pass `ResolvedConfig.permissions` to `createToolRegistry()` as permission overrides
- [x] 4.5 Update `src/cli.ts` default action to call `loadConfig()` and `loadProjectInstructions()`, then pass results to `startRepl`
- [x] 4.6 Add integration test that `startRepl` uses config-provided model and assembled system prompt (verify via agent loop options)
- [x] 4.7 Update existing REPL tests to accommodate the new `startRepl` signature

## 5. Manual Verification

- [x] 5.1 Manual test: create config files at all three scopes with different model values, verify the local scope wins
- [x] 5.2 Manual test: remove all config files and AGENTS.md, verify the agent starts with defaults and no errors
