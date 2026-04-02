# AI Coding Agent

A TypeScript CLI coding assistant powered by Anthropic's Claude. It can read, write, edit, and search files in your project, run shell commands, and stream responses in real time — all from an interactive terminal session.

## Prerequisites

- Node.js 22+
- An [Anthropic API key](https://console.anthropic.com/)

## Setup

```bash
npm install
```

Create a `.env` file in the project root:

```
ANTHROPIC_API_KEY=sk-ant-...
```

## Usage

Start the interactive chat:

```bash
npm run dev
```

Type a message and press Enter. Responses stream to the terminal as they're generated. Type `exit` or `quit` to leave, or press `Ctrl+C`.

### Plan mode

Start in plan mode to explore a codebase without making changes:

```bash
npm run dev -- --plan
```

Plan mode blocks mutating tools (`edit_file`, `write_file`, `bash`, `subagent`) while keeping read-only tools (`read_file`, `glob`, `grep`) available. Use it when you want the agent to investigate, analyze, or propose a plan before executing any changes.

Toggle plan mode at runtime with the `/plan` slash command:

```
> /plan
Plan mode ON — mutating tools disabled.
> /plan
Plan mode OFF — mutating tools re-enabled.
```

### Built-in commands

- `/status` shows current context usage
- `/plan` toggles plan mode on/off
- `/remember <fact>` stores a durable project memory
- `/recall [query]` lists stored memories or searches them
- `/forget <memoryId>` removes a stored memory

### Resuming a session

To resume a saved session:

```bash
npm run dev -- --resume <sessionId>
```

The agent stores project-scoped session and memory data under `.ai-agent/` in the current project.

### Example prompts

```
> Read package.json and summarize the dependencies
> Find all files in src/ that reference ToolRegistration
> Create a new file at src/utils/helpers.ts with a slugify function
> Run npm test
```

## Tools

The agent has access to six tools it can call autonomously during a conversation:

| Tool | Description |
|------|-------------|
| `read_file` | Read the contents of a file |
| `write_file` | Create or overwrite a file (creates parent directories automatically) |
| `edit_file` | Find-and-replace a specific string in a file (must match exactly once) |
| `glob` | Find files matching a glob pattern (e.g., `**/*.ts`) |
| `grep` | Search file contents by regex with file paths and line numbers |
| `bash` | Execute a shell command and return stdout, stderr, and exit code |

### Permissions

Each tool has a permission mode that controls whether it runs automatically or requires your approval:

- **allow** — Executes immediately with no prompt (`read_file`, `glob`, `grep`)
- **prompt** — Shows the tool name and arguments and asks you to approve before running (`write_file`, `edit_file`, `bash`)
- **deny** — Blocks execution and returns a denial to the model

When a tool requires approval, you'll see a prompt like:

```
⚡ Tool: bash
  command: npm test
  Allow? (y/n):
```

Type `y` to approve or `n` (or anything else) to deny. The agent will adapt if a tool call is denied.

## Development

```bash
npm run typecheck   # Type-check without emitting
npm run build       # Compile to dist/
npm test            # Run unit tests
```

## Project structure

```
src/
  cli.ts              # CLI entrypoint (loads API key, starts REPL)
  repl.ts             # Interactive prompt, approval prompts, conversation loop
  agent.ts            # Agent loop (streaming, tool execution, permission checks)
  api/anthropic.ts    # Anthropic REST client with SSE streaming
  tools/
    index.ts          # Tool registry and types
    read-file.ts      # read_file tool
    write-file.ts     # write_file tool
    edit-file.ts      # edit_file tool
    glob.ts           # glob tool
    grep.ts           # grep tool
    bash.ts           # bash tool
```
