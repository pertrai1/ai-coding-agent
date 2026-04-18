# AI Coding Agent

An interactive CLI coding assistant powered by Anthropic's Claude. It runs in your terminal, reads and writes files in your project, runs shell commands, and streams responses in real time — all from a conversational prompt.

Think of it as a pairing partner that can actually touch your codebase.

## What It Does

- **Reads, writes, and edits files** in your project
- **Searches** by file name (glob) or content (regex)
- **Runs shell commands** (test suites, builds, git, etc.)
- **Streams responses** as they're generated — no waiting for the full reply
- **Remembers facts** across sessions (`/remember`, `/recall`)
- **Resumes sessions** — pick up where you left off
- **Plan mode** — analyze first, code later (with approval flow)
- **Subagents** — delegates focused tasks to isolated agent instances
- **Auto-compresses context** when approaching the token limit

## Prerequisites

- **Node.js 22+**
- An **Anthropic API key** ([get one here](https://console.anthropic.com/))

## Quick Start

```bash
# 1. Clone and install
git clone https://github.com/pertrai1/ai-coding-agent.git
cd ai-coding-agent
npm install

# 2. Set your API key
cp .env.example .env
# Edit .env and replace the placeholder with your actual key:
# ANTHROPIC_API_KEY=sk-ant-...

# 3. Run it
npm run dev
```

You'll see the prompt. Type a message and press Enter. Responses stream to your terminal in real time.

```
AI Coding Agent
Type "exit" or "quit" to leave. Type /status for context info.

> Read package.json and summarize the dependencies
```

Type `exit` or `quit` to leave, or press `Ctrl+C`.

## Built-in Commands

These are entered at the prompt — they're not messages to the AI.

| Command | Description |
|---|---|
| `/status` | Show current model, context window usage, and session stats |
| `/model` | Show the current model |
| `/model <model-id>` | Switch to a different model (takes effect on next API call) |
| `/plan` | Activate plan mode — only read-only tools are available |
| `/plan off` | Deactivate plan mode |
| `/remember <fact>` | Store a durable project memory (persists across sessions) |
| `/recall` | List all stored memories |
| `/recall <query>` | Search stored memories by keyword |
| `/forget <memoryId>` | Remove a stored memory |

### Plan Mode

Plan mode disables all mutating tools (`write_file`, `edit_file`, `bash`) so the agent can only analyze your codebase using read-only tools. It produces a plan, then asks you to approve, reject, or provide modifications.

This is useful when you want the agent to understand the codebase and propose changes before making them.

```
[plan] > Refactor the auth module to use JWT instead of sessions
```

The agent will analyze your code and present a numbered plan. You can:
- Type `y` to approve — it exits plan mode and executes the plan
- Type `n` to reject — it revises the plan
- Type any other text — it incorporates your feedback and revises

## Session Persistence

Sessions are saved automatically when you exit. Data is stored in `.ai-agent/` in your project root:

```
.ai-agent/
  config.json              # Project-level config (shareable via git)
  config.local.json        # Local config overrides (gitignored)
  sessions/
    session_<id>.json      # Full conversation transcript
    session_<id>.summary.json  # Auto-generated summary
  memory/
    index.json             # Memory search index
    entries/
      mem_<id>.json        # Individual memory entries
```

### Resuming a Session

```bash
npm run dev -- --resume <sessionId>
```

When you start a fresh session, the agent loads:
1. Your **durable memories** (stored via `/remember`)
2. **Summaries** from recent sessions — so it has context about what you've been working on

### Project Instructions

Place an `AGENTS.md` file in your project root. Its contents are injected into the system prompt so the agent follows your project-specific conventions.

## Tools

The agent has seven tools it can call autonomously during a conversation:

| Tool | Description | Permission |
|---|---|---|
| `read_file` | Read the contents of a file | auto |
| `glob` | Find files matching a glob pattern (e.g., `**/*.ts`) | auto |
| `grep` | Search file contents by regex | auto |
| `write_file` | Create or overwrite a file (creates parent dirs) | asks approval |
| `edit_file` | Find-and-replace a specific string (must match exactly once) | asks approval |
| `bash` | Execute a shell command | asks approval |
| `subagent` | Spawn an isolated subagent for a focused task | asks approval |

### Permissions

Each tool has a permission mode:

- **allow** — Executes immediately with no prompt (`read_file`, `glob`, `grep`)
- **prompt** — Shows the tool name and arguments and asks you to approve before running (`write_file`, `edit_file`, `bash`, `subagent`)
- **deny** — Blocks execution and returns a denial to the model

When a tool requires approval:

```
⚡ Tool: bash
  command: npm test
  Allow? (y/n):
```

Type `y` to approve or `n` (or anything else) to deny. The agent adapts its approach if denied.

## Configuration

Configuration is loaded from three locations, merged in order (later files override earlier ones):

| Location | Purpose |
|---|---|
| `~/.config/ai-agent/config.json` | Global defaults (applies to all projects) |
| `.ai-agent/config.json` | Project-level config (shareable via git) |
| `.ai-agent/config.local.json` | Local overrides (gitignored) |

### Config Format

```json
{
  "model": "claude-sonnet-4-20250514",
  "systemPromptExtra": "Always use TypeScript strict mode.",
  "permissions": {
    "bash": "prompt",
    "write_file": "allow",
    "edit_file": "deny"
  }
}
```

**Options:**
- `model` — Default model to use (can be changed mid-session with `/model`)
- `systemPromptExtra` — Additional text appended to the system prompt
- `permissions` — Override per-tool permission modes (`allow`, `prompt`, or `deny`)

### Environment Variables

| Variable | Required | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | Yes | Your Anthropic API key |

Set it in `.env` or as an environment variable.

## Example Prompts

```
> Read package.json and summarize the dependencies
> Find all files in src/ that reference ToolRegistration
> Create a new file at src/utils/helpers.ts with a slugify function
> Run npm test
> Edit src/api/auth.ts to add input validation to the login handler
> Search for all TODO comments in the codebase
```

## Context Management

The agent tracks token usage against Claude's context window (200k tokens). You can check usage at any time with `/status`.

When context usage reaches 80%, the agent automatically **compresses** the conversation: it summarizes older turns and keeps only the most recent messages. This happens transparently — you'll see the agent continue working without interruption.

## Development

```bash
npm run dev         # Run the agent (development mode via tsx)
npm run typecheck   # Type-check without emitting
npm run build       # Compile TypeScript to dist/
npm run lint        # Lint with ESLint
npm run lint:fix    # Lint and auto-fix
npm test            # Run unit tests with Vitest
```

## Project Structure

```
src/
  cli.ts                    # CLI entrypoint (commander, loads API key)
  cli/runCli.ts             # CLI orchestration (config loading, validation)
  repl.ts                   # Interactive REPL loop, approval prompts, plan mode
  repl/
    bootstrap.ts            # Session startup (loads memories + summaries for context)
    commands.ts             # Slash command handlers (/status, /plan, /model, etc.)
  agent.ts                  # Agent loop (streaming, tool execution, compression)
  api/
    anthropic.ts            # Anthropic REST client with SSE streaming
    sse-parser.ts           # Server-sent events parser
  config/
    index.ts                # Config loading and merging (global + project + local)
    loadConfigFile.ts       # JSON config file parser
    merge.ts                # Config merge logic
    context.ts              # System prompt assembly (AGENTS.md + config)
    types.ts                # Config type definitions
  context/
    tracker.ts              # Token usage tracking and compression threshold
    compressConversation.ts # Automatic conversation summarization
    types.ts                # Context-related types
  persistence/
    sessions.ts             # Session transcript storage and retrieval
    memory.ts               # Durable memory store with tokenized search
  subagent/
    index.ts                # Subagent spawner (isolated agent instances)
    tool.ts                 # Subagent tool registration
  tools/
    index.ts                # Tool registry, types, and permission defaults
    readFileTool.ts         # read_file tool
    writeFileTool.ts        # write_file tool
    editFileTool.ts         # edit_file tool
    glob.ts                 # glob tool
    grep.ts                 # grep tool
    bash.ts                 # bash tool
```

## License

ISC
