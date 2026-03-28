## Context

The agent's model, system prompt, and tool permission defaults are hardcoded in `src/repl.ts` and `src/tools/index.ts`. An `AGENTS.md` exists at the project root but is never loaded at runtime. There is no mechanism for users to customize behavior per-machine or per-project without editing source.

Key current state:
- **System prompt**: static string in `repl.ts` line 10-11
- **Model**: hardcoded `"claude-sonnet-4-20250514"` in `repl.ts` line 12
- **Tool permissions**: set per-tool at registration time in each tool module (e.g., `bash.ts` sets `permission: "prompt"`)
- **Startup flow**: `cli.ts` loads `.env`, validates `ANTHROPIC_API_KEY`, imports and calls `startRepl(apiKey)`

The agent loop (`agent.ts`) already accepts `model`, `system`, and `toolRegistry` as parameters, so wiring in config-driven values requires changes at the startup/REPL layer, not the agent loop itself.

## Goals / Non-Goals

**Goals:**
- Load `AGENTS.md` from the current working directory at startup and include its content in the system prompt
- Introduce a three-tier config file system (global, project, local) with deterministic merge order
- Make model, tool permissions, and extra system prompt text configurable via config files
- Assemble the system prompt dynamically from base prompt + AGENTS.md content + config extra prompt
- Preserve current defaults when no config files or AGENTS.md are present

**Non-Goals:**
- Runtime config reloading (config is loaded once at startup)
- Config file creation/editing commands in the CLI
- Config schema migration or versioning
- Per-session or per-conversation config overrides
- GUI or interactive config editing
- Watching config files for changes

## Decisions

### Config file format: JSON

Use plain JSON files. The project already uses `package.json` and `tsconfig.json`, so JSON is the natural choice. No new parsing dependency needed — `JSON.parse` with `readFileSync` is sufficient.

**Alternative considered**: YAML or TOML. Both require additional parser dependencies and introduce a new format inconsistent with the rest of the project.

### Config file locations

Three scopes with fixed, conventional paths:

| Scope   | Path                                      | Purpose                  |
|---------|-------------------------------------------|--------------------------|
| Global  | `~/.config/ai-agent/config.json`          | User-wide defaults       |
| Project | `<cwd>/.ai-agent/config.json`             | Project-specific settings|
| Local   | `<cwd>/.ai-agent/config.local.json`       | Machine-local overrides  |

The local file uses `.local.json` suffix to signal it should be gitignored. Project setup instructions should recommend adding `.ai-agent/config.local.json` to `.gitignore`.

**Alternative considered**: A single config file at project root (e.g., `.ai-agent.json`). This doesn't support global defaults or machine-local overrides without an additional mechanism.

### Merge strategy: shallow property merge per section

Config objects are merged with later scopes overriding earlier ones. The merge is shallow per top-level key:
- Scalar values (`model`, `systemPromptExtra`): last-writer wins
- `permissions` object: shallow merge of tool-name keys — each tool permission in a later scope overrides that specific tool's permission from an earlier scope, but unmentioned tools retain their earlier value

```
global:   { model: "claude-sonnet-4-20250514", permissions: { bash: "deny" } }
project:  { permissions: { bash: "prompt" } }
local:    { model: "claude-haiku-4-5-20250514" }
result:   { model: "claude-haiku-4-5-20250514", permissions: { bash: "prompt" } }
```

**Alternative considered**: Deep merge. Adds complexity with negligible benefit given the flat config shape.

### Config schema

```typescript
type Config = {
  model?: string;
  systemPromptExtra?: string;
  permissions?: Record<string, "allow" | "prompt" | "deny">;
};
```

All fields are optional. Unknown keys are silently ignored (forward compatibility). Invalid permission values produce a startup warning and are skipped.

### System prompt assembly order

The system prompt is assembled by concatenating sections in this order:

1. **Base prompt** — the current hardcoded coding assistant prompt
2. **AGENTS.md content** — loaded from `<cwd>/AGENTS.md`, wrapped in a section header
3. **Config extra prompt** — from `systemPromptExtra` in resolved config

Each section is separated by a double newline. Missing sections are simply omitted.

### AGENTS.md loading

Read `AGENTS.md` from `process.cwd()` at startup using `readFileSync`. If the file doesn't exist, skip silently. The content is injected as-is (no parsing or transformation) into the system prompt between delimiters:

```
<project-instructions>
{contents of AGENTS.md}
</project-instructions>
```

**Alternative considered**: Parsing AGENTS.md for structured sections. Unnecessary complexity — the model can interpret the raw markdown.

### New module structure

Add `src/config/` with:
- `loader.ts` — reads and parses individual config files, returns `Config | null`
- `merge.ts` — merges an ordered array of `Config` objects
- `index.ts` — orchestrates loading all three scopes, merging, and returning a resolved `ResolvedConfig`
- `context.ts` — loads AGENTS.md content, assembles the full system prompt

### Integration into startup

`cli.ts` calls a new `loadConfig()` function before entering the REPL. The resolved config and AGENTS.md content are passed to `startRepl()`, which uses them to set the model, assemble the system prompt, and optionally override tool permissions.

The `startRepl` function signature changes from `startRepl(apiKey: string)` to `startRepl(apiKey: string, config: ResolvedConfig)` where `ResolvedConfig` includes the resolved config values and assembled system prompt.

`createToolRegistry()` gains an optional `permissionOverrides` parameter of type `Record<string, ToolPermission>` to apply config-driven permission changes after default registration.

## Risks / Trade-offs

**[Risk] Config file has invalid JSON** → Read errors are caught and logged as warnings. The agent continues with defaults. A malformed config file at one scope does not block loading from other scopes.

**[Risk] AGENTS.md is very large** → No size limit enforced. This is acceptable for now — if it becomes an issue, a future change can add a truncation warning. The content goes into the system prompt which has its own token budget.

**[Risk] Permission override names don't match tool names** → Unknown tool names in `permissions` config are silently ignored. A typo means the override doesn't take effect, but doesn't crash. This is intentional — config should be forward-compatible with tools that may not yet exist.

**[Trade-off] Startup cost** → Three filesystem reads (config files) plus one (AGENTS.md) adds ~1-4ms of blocking I/O at startup. Negligible compared to the first API call.

**[Trade-off] No config validation CLI** → Users won't get immediate feedback if their config is wrong. Mitigated by logging warnings for parse errors and invalid values.
