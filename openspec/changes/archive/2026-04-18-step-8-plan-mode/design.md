## Context

The agent currently has a single operational mode. Every user message goes through `runAgentLoop` (src/agent.ts:102-215), which streams a model response, executes any tool calls the model requests (checking permissions per-tool), and loops until the model returns a text-only response. The REPL (src/repl.ts:70-239) manages slash commands via `handleSlashCommand` (src/repl/commands.ts:37-94) and tracks mode state like the active model.

Plan mode adds a second operational state to the REPL. When active, the agent acts as a read-only architect: it can investigate code (read-only tools) but cannot make changes (mutating tools are denied). The model produces a structured plan that the user reviews before execution begins.

Key integration points:
- **Tool permission override**: Currently permissions are resolved once at registry creation (src/tools/index.ts:32-66) and checked per-call in the agent loop (src/agent.ts:164-189). Plan mode needs a runtime overlay.
- **System prompt**: Assembled by `assembleSystemPrompt` (src/config/context.ts:17-33) from base + project instructions + extra. Plan mode appends a planner appendix.
- **Slash commands**: Dispatched in the REPL loop (src/repl.ts:160-171) before messages go to the agent loop. The `/plan` command fits here.
- **Status display**: `/status` output formatted in `formatStatus` (src/repl/commands.ts:17-31).

## Goals / Non-Goals

**Goals:**
- Toggle plan mode via `/plan` (on) and `/plan off` (off) slash commands
- While active, deny all mutating tools (`write_file`, `edit_file`, `bash`) at the agent loop level
- Append a planner-oriented system prompt section that instructs the model to analyze and plan
- Provide an explicit user approval flow: after the model produces a plan, the user approves → exits plan mode → executes; rejects → stays in plan mode
- Show plan-mode state in `/status` output
- Add manual tests for: plan without edits, approved plan execution, rejected/revised plan

**Non-Goals:**
- Persisting plan mode across sessions (plan mode resets on restart)
- Partial plan execution (approve all or nothing)
- Nested plan modes (subagents don't inherit plan mode)
- Structured plan format (the plan is freeform model output; no JSON schema)

## Decisions

### Decision 1: Plan mode state lives in the REPL, not the agent loop

**Choice**: A `planMode: boolean` variable in `startRepl` (src/repl.ts:70), passed down via the existing options pattern.

**Rationale**: Plan mode is a REPL-level concern — it's toggled by slash commands, displayed in status, and controls how the REPL orchestrates the agent. The agent loop already accepts options; adding a `planMode` flag to `AgentLoopOptions` keeps the agent loop generic and testable. The agent loop doesn't need to know *why* tools are denied — it just needs to know *which* tools are denied.

**Alternative considered**: Storing plan mode state in the tool registry. Rejected because the registry is a static structure created once at startup; mutating it for mode switches would complicate the permission model and risk leaking state.

### Decision 2: Mutating-tool denial via an `isToolDenied` callback on agent loop options

**Choice**: Add an optional `isToolDenied?: (toolName: string) => boolean` callback to `AgentLoopOptions`. When plan mode is active, the REPL passes a callback that returns `true` for `write_file`, `edit_file`, and `bash`. The agent loop checks this *before* the existing permission check — if denied, it returns a structured denial result without consulting permissions.

**Rationale**: This avoids mutating the tool registry and keeps the agent loop's permission flow clean. The callback pattern mirrors the existing `promptForApproval` callback. When plan mode is off, the callback is either absent or always returns `false`, so the existing permission logic runs unchanged.

**Alternative considered**: Creating a second tool registry with all mutating tools set to `"deny"`. Rejected because it duplicates the registry and would require keeping two registries in sync (e.g., when the subagent tool is registered dynamically).

### Decision 3: Planner system prompt as an appendix injected at call time

**Choice**: When `planMode` is true, the REPL constructs the system prompt with an additional section appended after the normal prompt. The agent loop already receives the full system prompt as a string — no changes to the API layer needed.

**Rationale**: `assembleSystemPrompt` already composes from parts. The REPL can call it with a `planModeExtra` string when active. This avoids modifying the config system or prompt assembly function.

**Alternative considered**: Modifying `assembleSystemPrompt` to accept a `planMode` flag. Rejected — adding mode-specific logic to a general utility function violates separation of concerns. The REPL should own mode-dependent prompt construction.

### Decision 4: Approval flow as a REPL-level interaction after the agent loop returns

**Choice**: When plan mode is active and the agent loop completes (model returns text), the REPL checks if the output looks like a plan. It then prompts: "Approve this plan? (y/n/edit)". On `y`, plan mode is turned off and the approved plan text is re-injected as a user message for execution. On `n`, the user can provide feedback and the agent stays in plan mode. On `edit`, the user types modifications which are appended as a user message while staying in plan mode.

**Rationale**: The approval flow is conversational — it uses the same REPL input mechanism already in place. The model's plan text stays in conversation history, so when the user approves, the agent has full context for execution. No special "plan storage" is needed.

**Alternative considered**: A separate plan data structure with explicit steps. Rejected — too much ceremony for a feature where the model produces freeform plans. The conversation history already captures everything.

### Decision 5: Plan-mode prompt indicator

**Choice**: Change the REPL prompt from `> ` to `[plan] > ` when plan mode is active.

**Rationale**: Visual feedback is important — the user should immediately see which mode they're in. This is a simple string change in the REPL loop, using the existing `PROMPT` constant pattern.

## Risks / Trade-offs

- **Risk: Model produces changes despite planner prompt** → Mitigation: The tool-level denial is a hard constraint. Even if the model tries to call a mutating tool, the agent loop will deny it. The planner prompt is guidance; the denial callback is enforcement.
- **Risk: Approval flow feels clunky for simple plans** → Mitigation: The `/plan off` command lets users exit plan mode manually at any time, bypassing the approval flow. The approval prompt is shown after every agent response in plan mode, so users can approve whenever they're ready.
- **Risk: Plan text lost when transitioning to execution mode** → Mitigation: The plan stays in conversation history. When the user approves, their approval message is appended to history, giving the model full context.
- **Trade-off: No structured plan format** → Acceptable for now. Freeform plans are simpler and the model naturally produces numbered steps. A structured format (JSON plan schema) could be added later if needed.
