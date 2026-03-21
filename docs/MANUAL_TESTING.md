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

## Results Tracker

| Test   | Status | Date | Notes |
|--------|--------|------|-------|
| 1.1    |        |      |       |
| 1.2    |        |      |       |
| 1.3    |        |      |       |
| 1.4    |        |      |       |
