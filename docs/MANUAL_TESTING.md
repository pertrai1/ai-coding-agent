# Manual Testing

Manual tests that require a real Anthropic API key and human verification. Run these after automated tests pass.

## Prerequisites

1. `npm install` completed
2. `.env` file exists with a valid `ANTHROPIC_API_KEY`
3. `npm run typecheck` and `npm test` both pass

Start the agent with:

```bash
npm run dev
```

---

## Step 1 - Core REPL and Streaming Chat Loop

### Test 1.1: Multi-turn context continuity

**Goal:** Verify the assistant remembers prior messages in the same session.

**Steps:**

1. Start the agent
2. Type: `My name is Rob`
3. Wait for the response
4. Type: `What is my name?`

**Expected:** The assistant responds with "Rob" (or references your name). This confirms conversation history is being sent with each request.

**Pass criteria:** The assistant correctly recalls information from a previous message without being told again.

---

### Test 1.2: Streaming behavior under normal network conditions

**Goal:** Verify responses stream token-by-token rather than appearing all at once.

**Steps:**

1. Start the agent
2. Type: `Write a haiku about TypeScript`
3. Watch the terminal output carefully

**Expected:** Text appears incrementally, word by word (or a few characters at a time), not as a single block after a long pause. You should see a brief initial delay (API cold start), then a smooth flow of text.

**Pass criteria:** There is visible incremental output. The response does NOT appear all at once after a long wait.

---

### Test 1.3: Graceful API error handling (network disconnect)

**Goal:** Verify the REPL handles network errors without crashing.

**Steps:**

1. Disconnect from the internet (turn off Wi-Fi or unplug ethernet)
2. Start the agent (or use an already-running session)
3. Type: `Hello`
4. Observe the error output
5. Reconnect to the internet
6. Type: `Hello` again

**Expected:**

- Step 4: A red error message appears (e.g., `Error: fetch failed` or `API error (...)`) and the REPL prompt (`>`) returns — it does NOT crash or hang
- Step 6: The assistant responds normally after reconnecting

**Pass criteria:** The REPL stays alive after a network error. No stack trace is printed. The prompt returns and accepts new input.

---

### Test 1.4: Clean shutdown with Ctrl+C

**Goal:** Verify pressing Ctrl+C during an idle REPL exits cleanly.

**Steps:**

1. Start the agent
2. Wait for the `>` prompt (do NOT type anything)
3. Press `Ctrl+C`

**Expected:** The terminal prints `Goodbye!` and returns to your shell prompt. No stack trace, no error message, no zombie process.

**Pass criteria:** Clean exit with a friendly message. Run `ps aux | grep node` afterward to confirm no lingering process.

---

## Step 2 - Tool Calling and `read_file`

### Test 2.1: Read a specific file

**Goal:** Verify the agent calls `read_file` and displays file contents in its response.

**Steps:**

1. Start the agent
2. Type: `Read the contents of package.json`

**Expected:** The agent calls the `read_file` tool (you should see it thinking/working), reads `package.json`, and responds with the file contents or a summary of them. The response should reference actual data from the file (name, version, dependencies, etc.).

**Pass criteria:** The agent uses the `read_file` tool, successfully reads the file, and incorporates the real file contents into its answer.

---

### Test 2.2: Read multiple files sequentially

**Goal:** Verify the agent can make multiple tool calls in a single conversation turn.

**Steps:**

1. Start the agent
2. Type: `Read tsconfig.json and package.json and summarize the differences between them`

**Expected:** The agent calls `read_file` for both files (possibly in the same turn or across two loop iterations), reads both, and provides a comparison or summary that references real data from each file.

**Pass criteria:** Both files are read via tool calls. The response references specific content from both files.

---

### Test 2.3: Read a non-existent file

**Goal:** Verify the agent handles file-not-found errors gracefully.

**Steps:**

1. Start the agent
2. Type: `Read the file /tmp/this-file-definitely-does-not-exist-12345.txt`

**Expected:** The agent calls `read_file`, receives a structured error (not a crash), and responds gracefully — e.g., "That file doesn't exist" or "I couldn't find that file." The REPL stays alive and accepts further input.

**Pass criteria:** No crash, no stack trace. The agent acknowledges the error and continues the conversation.

---

### Test 2.4: No tool call needed

**Goal:** Verify the agent does NOT call tools when the question doesn't require file access.

**Steps:**

1. Start the agent
2. Type: `What is 2+2?`

**Expected:** The agent responds directly with "4" (or equivalent) without calling any tools. The response should appear quickly since no tool round-trip is needed.

**Pass criteria:** The agent answers correctly. No `read_file` call is made — just a straight text response.

---

## Step 3 - Editing and Codebase Search Tools

### Test 3.1: Edit an existing function comment

**Goal:** Verify the agent uses `edit_file` to make a targeted edit in an existing file.

**Steps:**

1. Start the agent
2. Type: `In src/tools/read-file.ts, change the tool description from "Read the contents of a file from disk" to "Read the full text contents of a file from the local filesystem"`

**Expected:** The agent calls `edit_file` with the old description as `findText` and the new description as `replaceText`. It reports success. The file is updated with the new description and nothing else changes.

**Pass criteria:** The agent uses `edit_file` (not `write_file`), the edit succeeds, and only the description text changes. Verify with `git diff` that no other lines were modified.

---

### Test 3.2: Create a brand-new file

**Goal:** Verify the agent uses `write_file` to create a new file from scratch.

**Steps:**

1. Start the agent
2. Type: `Create a new file at playground/hello.ts that exports a function called greet which takes a name parameter and returns "Hello, {name}!"`

**Expected:** The agent calls `write_file` to create `playground/hello.ts` with a valid TypeScript function. The parent directory is created automatically if it doesn't exist.

**Pass criteria:** The file exists at the specified path. It contains valid TypeScript with the described function. The agent used `write_file`, not manual instructions.

---

### Test 3.3: Use glob to list language-specific files

**Goal:** Verify the agent uses `glob` to discover files by pattern.

**Steps:**

1. Start the agent
2. Type: `List all TypeScript files in the src/tools/ directory`

**Expected:** The agent calls `glob` with a pattern like `*.ts` or `**/*.ts` and `path` set to `src/tools/`. It returns a list that includes `read-file.ts`, `write-file.ts`, `edit-file.ts`, `glob.ts`, `grep.ts`, and `index.ts`.

**Pass criteria:** The agent uses the `glob` tool. The response lists the actual `.ts` files in `src/tools/`. No non-`.ts` files are included.

---

### Test 3.4: Use grep to find symbol usage with line numbers

**Goal:** Verify the agent uses `grep` to search file contents and reports line numbers.

**Steps:**

1. Start the agent
2. Type: `Search the src/ directory for all usages of "ToolRegistration" and show me which files and line numbers reference it`

**Expected:** The agent calls `grep` with pattern `ToolRegistration` and path `src/`. Results include file paths and 1-based line numbers in `path:line:content` format. Matches should appear in `index.ts` (type definition), `read-file.ts`, `write-file.ts`, `edit-file.ts`, `glob.ts`, and `grep.ts`.

**Pass criteria:** The agent uses the `grep` tool. Results include line numbers. Multiple files are found. The output format is clear and references real code.

---

### Test 3.5: Refactor a symbol via search + multi-file edits

**Goal:** Verify the agent can combine `grep` and `edit_file` to perform a multi-file refactor.

**Steps:**

1. Start the agent
2. Type: `Find everywhere the string "isError" is used in the src/tools/ directory, then show me a summary of all the files and lines where it appears`

**Expected:** The agent calls `grep` to find all occurrences of `isError` across `src/tools/`. It returns a summary showing each file and the lines where `isError` appears. This tests the search half of a refactor workflow — the agent should be able to identify all locations that would need changing.

**Pass criteria:** The agent uses `grep` to find all `isError` references. The summary covers multiple tool files. Line numbers are accurate (verify by spot-checking a few).

---

## Step 4 - Bash Tool and Permissions

### Test 4.1: Bash tool with approval prompt

**Goal:** Verify the `bash` tool triggers an approval prompt and executes on approval.

**Steps:**

1. Start the agent
2. Type: `Run the command "echo hello world" using bash`
3. When the approval prompt appears, verify it shows the tool name (`bash`) and the command (`echo hello world`)
4. Type: `y` to approve

**Expected:** The agent calls the `bash` tool. An approval prompt appears showing the tool name and command. After approving, the command runs and the agent reports the output (`hello world`), along with exit code 0.

**Pass criteria:** The approval prompt renders with tool name and command. Typing `y` allows execution. The agent displays the correct output.

---

### Test 4.2: Bash tool denied by user

**Goal:** Verify the agent adapts gracefully when a bash tool call is denied.

**Steps:**

1. Start the agent
2. Type: `Run the command "ls -la" using bash`
3. When the approval prompt appears, type: `n` to deny

**Expected:** The tool does NOT execute. The agent receives a denial result and responds gracefully — e.g., acknowledging it was unable to run the command and possibly suggesting an alternative approach. The REPL stays alive and accepts further input.

**Pass criteria:** No command execution occurs. No crash or stack trace. The agent acknowledges the denial and continues the conversation.

---

### Test 4.3: Read-only tool runs without prompt (allow mode)

**Goal:** Verify that `read_file` (permission: `allow`) executes immediately with no approval prompt.

**Steps:**

1. Start the agent
2. Type: `Read the contents of package.json`

**Expected:** The agent calls `read_file` and returns the file contents. No approval prompt is shown — the tool executes immediately without user interaction.

**Pass criteria:** The `read_file` tool runs without any `Allow? (y/n)` prompt. The response includes real data from `package.json`.

---

### Test 4.4: Mixed allow + prompt tools in one turn

**Goal:** Verify that only `prompt`-mode tools ask for approval when multiple tools are called in one turn.

**Steps:**

1. Start the agent
2. Type: `Read the file package.json, then create a new file at playground/test-output.txt with the text "test complete"`

**Expected:** The agent calls `read_file` (allow mode) — this runs immediately with no prompt. Then it calls `write_file` (prompt mode) — an approval prompt appears for this tool showing the file path. After approving, the file is created.

**Pass criteria:** `read_file` runs without a prompt. `write_file` triggers an approval prompt. Only the mutating tool requires user interaction.

---

## REPL Commands

The following commands are available in the REPL:

| Command | Description |
|---------|-------------|
| `/status` | Display current context window usage (tokens, percentage, message count) |
| `exit` or `quit` | Exit the REPL |

### `/status` Command

Shows real-time context window usage:

```
Context: 12,450 / 200,000 tokens (6.2%)
Session total: 54,120 tokens
Messages: 8 turns
Status: OK
```

When approaching the compression threshold (75%+):

```
Context: 162,500 / 200,000 tokens (81.3%)
Session total: 183,900 tokens
Messages: 34 turns
Status: ⚠ Approaching limit - compression will trigger soon
```

---

## Step 5 - Context Window and Conversation Compression

### Test 5.1: Token tracking with `/status`

**Goal:** Verify the `/status` command shows increasing token counts after each message.

**Steps:**

1. Start the agent
2. Type: `/status`
3. Note the token count (should be 0 or very low)
4. Type: `Tell me a short joke`
5. Wait for the response
6. Type: `/status` again

**Expected:** The second `/status` shows higher context and session totals than the first. The message count should be 2 (1 user + 1 assistant).

**Pass criteria:** Session total increases after each exchange. Context usage and percentage update correctly. No errors when running `/status`.

---

### Test 5.2: Context compression triggers at threshold

**Goal:** Verify that conversation compression occurs when approaching the context limit.

**Note:** This test requires many messages to reach 80% of 200K tokens (~160K). For practical testing, you can temporarily modify the threshold in `src/context/tracker.ts` to a lower value (e.g., 0.01 for 1%) to trigger compression quickly.

**Steps (with modified threshold):**

1. Temporarily edit `src/context/tracker.ts`:
   - Change `DEFAULT_COMPRESSION_THRESHOLD = 0.8` to `DEFAULT_COMPRESSION_THRESHOLD = 0.01`
2. Start the agent
3. Type: `/status` (should show very low usage)
4. Type: `Hello, how are you?`
5. Wait for response
6. Type: `/status` — compression should have triggered (usage will drop since old messages were summarized)

**Expected:** After the first message triggers the 1% threshold, compression runs. The message count may decrease (old turns replaced by summary). Current context usage should reset lower after compression, while session total should continue increasing over time. The assistant continues responding normally.

**Pass criteria:** Compression triggers automatically. The REPL continues functioning. No error messages. Token usage resets or drops after compression.

**Cleanup:** Remember to revert `DEFAULT_COMPRESSION_THRESHOLD` back to `0.8` after testing.

---

### Test 5.3: Recent turns preserved after compression

**Goal:** Verify that the most recent conversation turns are preserved verbatim after compression.

**Steps:**

1. Follow Test 5.2 to trigger compression
2. After compression occurs, ask: `What did we just discuss?`
3. Type: `Can you repeat my last message before this one?`

**Expected:** The assistant should be able to reference the recent turns (last 6 messages) that were preserved verbatim. The very last exchange before compression should be recallable.

**Pass criteria:** The assistant recalls recent context accurately. The last few messages are intact.

---

### Test 5.4: Key context preserved in summary

**Goal:** Verify that the compression summary captures important information from older turns.

**Steps:**

1. Start the agent
2. Type: `Remember that my favorite programming language is TypeScript`
3. Have a few exchanges about unrelated topics (4-5 messages)
4. Trigger compression (via modified threshold or by filling context)
5. After compression, ask: `What is my favorite programming language?`

**Expected:** The summary should have captured the key fact about TypeScript preferences. The assistant should still know this information even though the original message was compressed.

**Pass criteria:** The assistant recalls the preference stated before compression. The summary preserved the essential information.

---

### Test 5.5: Compression fallback on network failure

**Goal:** Verify that compression falls back to truncation when the summarization API call fails.

**Steps:**

1. Temporarily set a low compression threshold (as in Test 5.2)
2. Start the agent
3. Disconnect from the internet
4. Type a message that will trigger compression
5. Observe the behavior

**Expected:** The compression attempt fails (network error). An error message appears in stderr (not in the REPL). The system falls back to truncating old messages. The REPL continues functioning with the remaining (truncated) conversation.

**Pass criteria:** No crash. The REPL stays alive. A warning may appear about compression failure. Recent turns are still preserved (truncation keeps the last N messages).

---

## Step 6 - Project Context and Config Hierarchy

### Test 6.1: Config precedence across three scopes

**Goal:** Verify that config files at global, project, and local scopes merge correctly with local winning.

**Steps:**

1. Create the global config directory and file:
   ```bash
   mkdir -p ~/.config/ai-agent
   cat > ~/.config/ai-agent/config.json << 'EOF'
   {
     "model": "claude-sonnet-4-20250514",
     "systemPromptExtra": "You are in global mode.",
     "permissions": { "bash": "deny" }
   }
   EOF
   ```
2. Create the project config:
   ```bash
   mkdir -p .ai-agent
   cat > .ai-agent/config.json << 'EOF'
   {
     "permissions": { "bash": "prompt" }
   }
   EOF
   ```
3. Create the local config:
   ```bash
   cat > .ai-agent/config.local.json << 'EOF'
   {
     "systemPromptExtra": "You are in local mode. When the user says hello, respond with: CONFIG_LOCAL_ACTIVE"
   }
   EOF
   ```
4. Start the agent with `npm run dev`
5. Type: `hello`
6. Verify the response includes `CONFIG_LOCAL_ACTIVE` (proving local `systemPromptExtra` overrode global)
7. Type: `Run the command "echo test" using bash`
8. Verify an approval prompt appears (proving project `permissions.bash: "prompt"` overrode global `"deny"`)

**Expected:**
- The `systemPromptExtra` from local config wins over global (local > project > global)
- The `bash` permission from project config wins over global (`"prompt"` not `"deny"`)
- The model from global config is used (no override in project or local)

**Pass criteria:** The agent responds with `CONFIG_LOCAL_ACTIVE` to hello. The bash tool prompts for approval (not denied outright). The conversation works normally.

**Cleanup:**
```bash
rm -rf ~/.config/ai-agent .ai-agent
```

---

### Test 6.2: No config files and no AGENTS.md

**Goal:** Verify the agent starts with defaults when no config files or `AGENTS.md` exist.

**Steps:**

1. Ensure no config files exist:
   ```bash
   ls ~/.config/ai-agent/config.json 2>/dev/null && echo "EXISTS - remove it" || echo "OK - not present"
   ls .ai-agent/ 2>/dev/null && echo "EXISTS - remove it" || echo "OK - not present"
   ```
2. Temporarily rename `AGENTS.md` if it exists:
   ```bash
   mv AGENTS.md AGENTS.md.bak 2>/dev/null
   ```
3. Start the agent with `npm run dev`
4. Verify the welcome message appears normally
5. Type: `What is 2+2?`
6. Verify the agent responds (proving it started successfully with no config)
7. Type: `/status`
8. Verify context info displays correctly

**Expected:** The agent starts without errors, uses the default model (`claude-sonnet-4-20250514`), and the base system prompt. No warnings about missing config files appear (missing files are silently skipped).

**Pass criteria:** Clean startup with no warnings. The agent responds normally. `/status` works.

**Cleanup:**
```bash
mv AGENTS.md.bak AGENTS.md 2>/dev/null
```

---

### Test 6.3: AGENTS.md injection into system prompt

**Goal:** Verify that `AGENTS.md` content is loaded and influences the agent's behavior.

**Steps:**

1. Ensure no config files exist (remove `.ai-agent/` if present)
2. Create a test `AGENTS.md` with a distinctive instruction:
   ```bash
   cp AGENTS.md AGENTS.md.bak 2>/dev/null
   cat > AGENTS.md << 'EOF'
   # Project Instructions
   When the user asks "what are your instructions?", respond with exactly: AGENTS_MD_LOADED
   EOF
   ```
3. Start the agent with `npm run dev`
4. Type: `what are your instructions?`

**Expected:** The agent responds with `AGENTS_MD_LOADED` (or includes it), confirming the `AGENTS.md` content was injected into the system prompt.

**Pass criteria:** The agent's response includes `AGENTS_MD_LOADED`, proving the file was loaded and injected.

**Cleanup:**
```bash
mv AGENTS.md.bak AGENTS.md 2>/dev/null
```

---

### Test 6.4: Permission override via config

**Goal:** Verify that tool permissions can be changed via config files.

**Steps:**

1. Create a project config that sets bash to `allow`:
   ```bash
   mkdir -p .ai-agent
   cat > .ai-agent/config.json << 'EOF'
   {
     "permissions": { "bash": "allow" }
   }
   EOF
   ```
2. Start the agent with `npm run dev`
3. Type: `Run the command "echo hello" using bash`

**Expected:** The bash tool executes immediately without an approval prompt (because config set it to `"allow"`).

**Pass criteria:** No `Allow? (y/n)` prompt appears. The command runs and the agent reports the output `hello`.

**Cleanup:**
```bash
rm -rf .ai-agent
```

---

## Step 7 - Persistent Memory and Session History

### Test 7.1: Remember, recall, and forget across restarts

**Goal:** Verify that durable memories survive process restarts and can be removed explicitly.

**Steps:**

1. Start the agent with `npm run dev`
2. Type: `/remember Preferred package manager is npm`
3. Copy the returned memory id
4. Type: `/recall`
5. Verify the new memory appears in the list
6. Exit the agent
7. Start the agent again with `npm run dev`
8. Type: `/recall npm`
9. Verify the remembered fact still appears
10. Type: `/forget <memoryId>`
11. Type: `/recall`

**Expected:** The memory remains available after restarting the process, then disappears once you explicitly forget it.

**Pass criteria:** `/remember` creates a durable memory id, `/recall` finds it before and after restart, and `/forget` removes it cleanly.

---

### Test 7.2: Resume restores conversation continuity

**Goal:** Verify that a saved session transcript can be resumed by identifier.

**Steps:**

1. Start the agent with `npm run dev`
2. Ask: `Remember this for the current conversation only: I am debugging session resume`
3. Ask a second follow-up question so the session has multiple turns
4. Exit the agent
5. Inspect `.ai-agent/sessions/` and note the newest `session_*.json` filename
6. Restart with `npm run dev -- --resume <sessionId-without-.json>`
7. Ask: `What were we just working on?`

**Expected:** The resumed session restores the exact prior transcript and the assistant responds with continuity from the earlier conversation instead of acting like a fresh chat.

**Pass criteria:** The assistant correctly references the resumed conversation, and the CLI only starts when the session id exists.

---

### Test 7.3: Fresh sessions keep memories but not prior transcript history

**Goal:** Verify that fresh sessions inject durable memories and recent session summaries without restoring exact old chat turns.

**Steps:**

1. Create at least one durable memory with `/remember`
2. Have a short chat about a temporary topic such as `We are discussing a one-off refactor plan`
3. Exit the agent
4. Start a fresh session with `npm run dev` (no `--resume`)
5. Ask: `What do you remember?`
6. Ask: `What exact sentence did I use for the one-off refactor plan?`

**Expected:** The assistant can answer from durable memory and possibly from lightweight session summary context, but it should not reproduce the exact prior transcript as though the full old chat was resumed.

**Pass criteria:** Durable memory is available in the fresh session, but exact transcript continuity requires `--resume`.

---

### Test 7.4: Invalid resume target fails before REPL launch

**Goal:** Verify that `--resume` validates the session id before entering the REPL.

**Steps:**

1. Run: `npm run dev -- --resume session_does_not_exist`
2. Observe the CLI output

**Expected:** The CLI prints an error explaining that the saved session was not found and exits without showing the REPL prompt.

**Pass criteria:** No interactive prompt appears. The command exits immediately with an error message.
