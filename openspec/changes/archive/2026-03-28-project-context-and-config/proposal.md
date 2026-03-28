## Why

The agent currently hardcodes its model, system prompt, and tool permission defaults directly in source code. There is no way for users to customize behavior per-project or per-machine, and the existing `AGENTS.md` file at the project root is never loaded at runtime. Adding a config hierarchy and project context injection lets users tailor agent behavior without modifying source, and gives the agent project-specific instructions automatically.

## What Changes

- Load `AGENTS.md` from the working directory's project root at startup and inject its contents into the system prompt sent to the model.
- Introduce a three-tier config file system: global (`~/.config/ai-agent/config.json`), project (`<project-root>/.ai-agent/config.json`), and local (`<project-root>/.ai-agent/config.local.json`).
- Merge config with later scopes overriding earlier ones: global < project < local.
- Support config keys for: provider/model selection, per-tool permission defaults, and extra system prompt text.
- Assemble the system prompt dynamically from the base prompt, `AGENTS.md` content, and config-provided extra prompt text.
- Wire resolved config into the REPL bootstrap so the agent loop, tool registry, and API client all use configured values.
- Handle missing config files and missing `AGENTS.md` gracefully — the agent starts with sensible defaults when none are present.

## Capabilities

### New Capabilities
- `project-context`: Loading `AGENTS.md` from the project root and injecting its contents into the conversation system prompt at startup.
- `config-hierarchy`: Three-tier config file discovery, loading, validation, and merge logic (global < project < local).

### Modified Capabilities
- `cli-bootstrap`: Startup sequence changes to load config and project context before entering the REPL.
- `tool-permissions`: Permission defaults become configurable via config files rather than solely hardcoded.
- `repl-chat-loop`: System prompt assembly becomes dynamic, incorporating project context and config-provided extra prompt text; model selection comes from resolved config.

## Impact

- **Source files**: `src/cli.ts`, `src/repl.ts`, and `src/tools/index.ts` gain config-driven initialization. New modules added under `src/config/` for loading and merging.
- **System prompt**: Changes from a static string to a dynamically assembled prompt, which affects every model interaction.
- **Tool permissions**: Default permission modes become overridable per config scope, changing the effective permission for any tool at startup.
- **Dependencies**: May add a JSON schema validation library for config files, or handle validation manually.
- **Filesystem**: Reads new paths at startup (`~/.config/ai-agent/config.json`, `.ai-agent/config.json`, `.ai-agent/config.local.json`, `AGENTS.md`). All reads are optional and failure-tolerant.
- **No breaking changes**: Existing behavior is preserved when no config files or `AGENTS.md` are present — current hardcoded values become the defaults.
