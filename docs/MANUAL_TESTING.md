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
