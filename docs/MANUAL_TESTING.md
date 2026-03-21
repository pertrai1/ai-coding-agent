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
