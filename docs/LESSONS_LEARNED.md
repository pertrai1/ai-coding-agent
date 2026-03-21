# Lessons Learned

Bugs we hit, why they happened, and how we fixed them. A reference for future debugging.

---

## 1. Ctrl+C crashes with `AbortError` instead of exiting cleanly

**Step:** 1 - Core REPL and Streaming Chat Loop

**Symptom:**

Pressing Ctrl+C at the REPL prompt produced a stack trace instead of a clean exit:

```
node:internal/readline/interface:1331
            this[kQuestionReject]?.(new AbortError('Aborted with Ctrl+C'));
                                    ^

AbortError: Aborted with Ctrl+C
    at [_ttyWrite] (node:internal/readline/interface:1331:37)
    at ReadStream.onkeypress (node:internal/readline/interface:284:20)
    ...
```

**Root cause:**

We used `process.on("SIGINT", handler)` to catch Ctrl+C and call `process.exit(0)`. But Node's `readline/promises` API has its own Ctrl+C behavior — when `rl.question()` is waiting for input and the user presses Ctrl+C, readline **rejects the pending promise** with an `AbortError` _before_ our SIGINT handler gets a chance to run `process.exit(0)`. The rejected promise unwinds the call stack, and since nothing catches it, Node prints the unhandled rejection as a crash.

In short: our SIGINT handler and readline's promise rejection were **racing**, and readline won every time.

**Fix:**

Removed the `process.on("SIGINT")` handler entirely. Instead, wrapped `rl.question()` in a try/catch that detects `AbortError` by name and treats it as a clean exit:

```typescript
try {
  input = await rl.question(PROMPT);
} catch (error: unknown) {
  if (isAbortError(error)) {
    process.stdout.write("\n");
    console.log(chalk.cyan("Goodbye!"));
    return;
  }
  throw error;
}
```

Also replaced all `process.exit(0)` calls with `return`, which lets the `finally` block run and close the readline interface properly. This is better practice anyway — `process.exit()` skips cleanup code.

**Takeaway:**

`readline/promises` owns Ctrl+C behavior when a `question()` is pending. Don't fight it with a competing SIGINT handler. Catch the `AbortError` instead. This applies to Node.js 18+ where `readline/promises` was stabilized.

