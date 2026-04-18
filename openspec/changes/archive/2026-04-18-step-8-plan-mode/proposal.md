## Why

The agent currently operates in a single mode — it can immediately execute any tool the model requests (subject to permissions). For larger tasks, users need a way to review the agent's approach before any code is modified. Plan mode introduces a read-only "architect" phase where the agent investigates the codebase, asks questions, and produces a step-by-step plan. Only after explicit user approval does the agent switch to execution mode and carry out the plan. This matches the ROADMAP Step 8 requirement and provides a safer workflow for high-stakes changes.

## What Changes

- Add a `plan` / `plan off` slash command that toggles plan mode on and off.
- While plan mode is active, the agent loop SHALL deny all mutating tools (`write_file`, `edit_file`, `bash`) regardless of their configured permission — effectively treating them as `"deny"`. Read-only tools (`read_file`, `glob`, `grep`) and the `subagent` tool remain available.
- While plan mode is active, the system prompt SHALL include a planner-oriented appendix instructing the model to analyze, ask clarifying questions, and produce ordered actionable steps rather than making changes.
- When the model produces a plan, the user SHALL review it and approve, modify, or reject it. Approval exits plan mode into execution mode; the agent then executes the approved steps sequentially.
- Rejection or modification keeps the agent in plan mode, allowing the model to revise its plan without making changes.
- The REPL status display (`/status`) SHALL indicate whether plan mode is active.

## Capabilities

### New Capabilities
- `plan-mode`: A REPL toggle that forces all mutating tools into deny mode and appends a planner-oriented system prompt, with an approval flow to transition into execution mode.

### Modified Capabilities
- `repl-chat-loop`: Add `/plan` and `/plan off` slash commands, and show plan-mode status in the prompt indicator and `/status` output.
- `tool-permissions`: Plan mode overrides configured permissions for mutating tools at runtime, treating them as deny without modifying the underlying tool registrations.

## Impact

- **Source files**: `src/repl.ts` (slash command dispatch, mode state), `src/repl/commands.ts` (new `/plan` command), `src/agent.ts` (permission override from plan mode), `src/config/context.ts` (plan-mode system prompt appendix).
- **Existing specs**: `repl-chat-loop` and `tool-permissions` specs will need delta updates for the new behavior.
- **No new dependencies**: All functionality builds on existing agent loop, tool registry, and REPL infrastructure.
- **No breaking changes**: Plan mode is opt-in via slash command; default behavior is unchanged.
