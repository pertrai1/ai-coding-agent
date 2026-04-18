## 1. Agent Loop: Tool Denial Callback

- [x] 1.1 Add `isToolDenied?: (toolName: string) => boolean` to `AgentLoopOptions` type in `src/agent.ts`
- [x] 1.2 Implement the denial check in `runAgentLoop` — before the existing permission check, if `isToolDenied` returns `true`, return a structured denial result with `isError: true` and a plan-mode denial message
- [x] 1.3 Add unit tests in `src/__tests__/agent-plan-mode.test.ts` for the `isToolDenied` callback: denied tool returns error, allowed tool passes through, callback absent means no extra denial

## 2. Plan Mode Slash Command

- [x] 2.1 Add `/plan` and `/plan off` handling to `handleSlashCommand` in `src/repl/commands.ts` — accept `getPlanMode` and `setPlanMode` callbacks in `HandleSlashCommandOptions`
- [x] 2.2 Add `planMode: boolean` state variable in `startRepl` (`src/repl.ts`), wire `getPlanMode`/`setPlanMode` into the slash command options
- [x] 2.3 Display confirmation message on toggle (e.g., "Plan mode activated" / "Plan mode deactivated")
- [x] 2.4 Add unit tests for `/plan` and `/plan off` slash commands in `src/__tests__/commands-plan.test.ts`

## 3. Plan Mode Prompt Indicator

- [x] 3.1 In `startRepl`, change the prompt string dynamically: use `[plan] > ` when `planMode` is true, `> ` when false
- [x] 3.2 Update the `rl.question()` call to use the dynamic prompt instead of the static `PROMPT` constant

## 4. Planner System Prompt

- [x] 4.1 Define a `PLAN_MODE_PROMPT` constant in `src/repl.ts` containing the planner-oriented system prompt appendix (instruct model to analyze, ask questions, produce ordered steps, and NOT make changes)
- [x] 4.2 In the REPL loop, when calling `runAgentLoop`, conditionally append `PLAN_MODE_PROMPT` to the `system` option when `planMode` is true

## 5. Tool Denial Wiring in REPL

- [x] 5.1 In `startRepl`, create an `isToolDenied` callback that returns `true` for `write_file`, `edit_file`, and `bash` when `planMode` is true
- [x] 5.2 Pass the `isToolDenied` callback to `runAgentLoop` options in the REPL loop

## 6. Plan Approval Flow

- [x] 6.1 In the REPL loop, after `runAgentLoop` completes, if `planMode` is true, prompt the user with an approval question (e.g., "Approve this plan? (y to approve / n to reject / or type modifications)")
- [x] 6.2 On `y`: deactivate plan mode, append a user message to conversation history instructing the agent to execute the plan
- [x] 6.3 On `n`: keep plan mode active, append a rejection message to conversation history
- [x] 6.4 On other text: keep plan mode active, append the user's feedback as a user message (the agent revises the plan)

## 7. Status Command Update

- [x] 7.1 Update `HandleSlashCommandOptions` to include `getPlanMode: () => boolean`
- [x] 7.2 Update `formatStatus` to include a "Mode: plan" line when plan mode is active
- [x] 7.3 Wire `getPlanMode` from REPL state into slash command options

## 8. Unit Tests

- [x] 8.1 Add test: `isToolDenied` callback denies mutating tools in `src/__tests__/agent-plan-mode.test.ts`
- [x] 8.2 Add test: `isToolDenied` absent or returning false falls through to normal permissions
- [x] 8.3 Add test: `/plan` and `/plan off` slash command parsing in `src/__tests__/commands-plan.test.ts`
- [x] 8.4 Verify `typecheck` passes after all changes

## 9. Manual Tests

- [x] 9.1 Manual test: activate plan mode, ask agent to implement a feature, verify it produces a plan without making any file edits
- [x] 9.2 Manual test: approve a plan, verify the agent switches to execution mode and implements the approved steps
- [x] 9.3 Manual test: reject or modify a plan, verify the agent revises without executing

## 10. ROADMAP and Documentation

- [x] 10.1 Update ROADMAP.md: mark all 7 remaining Step 8 items as complete (`- [x]`)
- [x] 10.2 Add Step 8 plan-mode entry to `docs/SOCRATIC_JOURNAL.md` with file paths and architectural decisions
- [x] 10.3 Update `docs/FOR-Rob-Simpson.md` with plan-mode architecture, usage, and lessons learned
