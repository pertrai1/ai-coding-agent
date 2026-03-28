# Step 1: The Core Chat Loop

Welcome to the first deep dive into our AI coding agent. We just finished Step 1, which is the foundation for everything that follows. We built a real-time, streaming chat interface that talks directly to Anthropic's Claude. It's not just a simple script. It's a solid starting point for a tool that will eventually edit your code and run your tests.

## Technical Architecture

The system works like a relay race with three main runners.

First, `cli.ts` starts the show. It loads your environment variables and checks for your API key. If everything looks good, it hands off control to the REPL.

Next, `repl.ts` manages the interactive session. It waits for you to type something, adds your message to the conversation history, and then calls the API client.

Finally, `api/anthropic.ts` handles the heavy lifting of talking to the internet. It sends your messages to Anthropic using a POST request and listens for a stream of data coming back.

The data flow is a loop. You type a message. We add it to an array. We send that array to Anthropic. They send back a stream of events, which are little chunks of text. We parse those events and print the text to your screen as it arrives. Once the stream ends, we add the full assistant response to our history array and wait for your next input.

## Codebase Structure

We kept the code organized so it's easy to find what you need.

* `src/cli.ts`: This is the front door. It uses the `commander` library to handle command-line arguments and `dotenv` to load your API key.
* `src/api/anthropic.ts`: This is our custom REST client. It contains the types for the Anthropic API, the fetch wrapper, and the logic to parse the streaming data.
* `src/repl.ts`: This is the interactive loop. It uses Node's `readline` module to get your input and `chalk` to make the terminal output look nice.
* `src/__tests__/`: We have unit tests for both the API client and the REPL. We use `vitest` to make sure our SSE parser and history management work exactly as expected.

## Technologies and Why

We made some specific choices to keep the project lean and modern.

We used the native `fetch` API instead of adding a library like Axios. Since we're on Node 20, `fetch` is built-in and works great with streams. It keeps our dependency list short.

We wrote our own SSE (Server-Sent Events) parser. It's only about 70 lines of code. Using a library for this would have been overkill. The SSE spec is simple. It just looks for lines starting with `event:` or `data:`.

For the input loop, we chose `readline/promises`. It's a built-in Node module that provides a clean async/await interface for terminal input. It's perfect for a REPL.

We used `AsyncGenerator` for the streaming logic. This is a powerful TypeScript feature that lets us yield chunks of text as they arrive. It makes the code very readable because you can use a simple `for await...of` loop to handle the stream.

Our conversation history is just a plain array of message objects. We didn't need a complex database or state management library yet. The Anthropic API expects an array, so we just keep one in memory.

## Key Concepts Explained

### Server-Sent Events (SSE)

Think of SSE like a radio broadcast. The server keeps the connection open and sends out a series of messages. Each message has an `event` type and some `data`. Anthropic sends a specific sequence. It starts the message, starts a content block, sends many small deltas (the actual text), stops the block, and finally stops the message. Our parser listens for these and turns them into objects we can use.

### Streaming vs Buffered

If we didn't use streaming, you'd have to wait for Claude to finish its entire thought before seeing anything. For long responses, you'd be staring at a blank screen for ten seconds. With streaming, we use `process.stdout.write()` to print each character the moment it arrives. It feels much more alive and responsive.

### AsyncGenerator Pattern

An `AsyncGenerator` is like a conveyor belt that pauses until you're ready for the next item. When the API client gets a chunk of data, it yields it. The REPL pulls that chunk and prints it. This creates a natural flow and prevents the system from getting overwhelmed if data arrives faster than we can process it.

### Conversation History

Claude doesn't remember your previous messages on its own. Every time you send a new message, we have to send the entire conversation history back to it. It's like a text thread where you scroll up to see what was said before. Claude reads the whole thread every single time to understand the context of your latest question.

## Design Decisions and Rationale

We decided to call the REST API directly instead of using the official Anthropic SDK. This was a deliberate choice to keep the project low level so you can see exactly how the protocol works. It also saved us from a large dependency.

We chose to fail fast. If your API key is missing, the agent tells you immediately when you try to start a chat. However, we don't crash if you just run `--help`. This makes the tool more polite and easier to use in different environments.

We separated the API logic from the REPL logic. The API client doesn't know anything about the terminal, and the REPL doesn't know anything about HTTP headers. This separation of concerns makes the code much easier to test and extend later.

## Lessons Learned and Pitfalls

One surprise was how TypeScript handles ESM (ECMAScript Modules). Even though we're writing `.ts` files, our imports have to end in `.js`. This is a requirement of the `nodenext` module resolution. It feels weird at first, but you get used to it.

We had to be careful with line endings in the SSE parser. Some systems use `\n` and others use `\r\n`. Our parser handles both by checking for that extra `\r` character.

Error handling in streams is tricky. If the connection drops halfway through a response, we have a partial message. We decided to show the error to the user but not add that partial, broken message to the history. This keeps the conversation clean.

Testing ESM modules with `vitest` required some new tricks. Mocking a module works differently than it did in the old CommonJS days. We also had to mock `process.exit` in our tests so they wouldn't actually close the terminal when testing error paths.

## How Good Engineers Think

Good engineers focus on separation of concerns. Each part of our code has one job. The HTTP client handles the internet. The parser handles the format. The REPL handles the user. This makes the system modular.

We also match our internal data structures to the external API. Our `Message` type looks exactly like what Anthropic expects. This means we don't need translation code that just adds complexity and bugs.

We value simplicity. We replaced a whole SDK with 300 lines of our own code. This gives us total control and a deeper understanding of how our tools work.

Finally, we design for extension. Because we used the `AsyncGenerator` pattern, adding tool calling in Step 2 will be easy. We just need to handle a few more event types in our loop. The foundation is already solid.

# Step 2: Giving the Agent Hands

Now that we can talk to Claude, it's time to give it some tools. In Step 2, we taught our agent how to read files. This is a huge leap. It's the difference between a chatbot that just talks and an assistant that can actually look at your project.

## Technical Architecture

The architecture grew a bit more complex here. We introduced a new "brain" called the agent loop.

The `runAgentLoop` in `src/agent.ts:84-161` is the heart of the system. It's a cycle: send a message, get a response, check if Claude wants to use a tool, execute that tool, and then send the results back to Claude. This loop continues until Claude gives a final text answer or we hit our safety limit of 10 iterations (`src/agent.ts:84-85`).

We also added a `createStreamAccumulator` in `src/agent.ts:17-82`. Claude sends tool calls in tiny pieces over a stream. We need a way to glue those pieces back together before we can run the tool.

The `ToolRegistry` in `src/tools/index.ts:28-50` acts like a toolbox. It keeps track of all the tools we've built and knows how to describe them to Claude so he knows how to use them.

## Codebase Structure

We added a few new directories and files to keep things tidy.

* `src/agent.ts`: This is where the high-level logic lives. It manages the loop and the stream accumulation.
* `src/tools/`: This is a new folder for all our tool implementations.
* `src/tools/index.ts`: This file defines the interfaces for tools and the registry that manages them.
* `src/tools/read-file.ts`: Our very first tool. It's a simple wrapper around Node's file system that lets Claude read any file in your project (`src/tools/read-file.ts:5-47`).
* `src/api/anthropic.ts`: We updated this to handle new types of content blocks like `tool_use` and `tool_result` (`src/api/anthropic.ts:7-26`).

## Technologies and Why

We stuck with our "keep it simple" philosophy.

For tool inputs, we use JSON. Claude sends us a JSON object with the arguments for the tool. We parse this JSON once the stream for that block is complete.

We used a `ToolRegistration` pattern in `src/tools/index.ts:10-20`. This separates the "schema" (the description Claude sees) from the "executor" (the actual TypeScript code that runs). This is great for testing because we can swap out real tools for fake ones to see how the agent behaves.

A single message from Claude can now contain both text and multiple tool calls. We moved from simple strings to an array of `ContentBlock` objects for our messages (`src/api/anthropic.ts:7-26`). Using an array makes it much easier to handle these complex responses without messy string parsing.

## Key Concepts Explained

### The Agent Loop

Think of the agent loop like a conversation where you're the one doing the chores. Claude says, "I need to see `package.json` to answer that." Our code sees that request, reads the file, and hands it back to Claude. Claude then says, "Okay, I see you're using Node 20. Here's your answer." The loop handles all that back-and-forth automatically.

### Stream Accumulation

When Claude calls a tool, he doesn't send the whole request at once. He sends it in chunks, like "read", then "_fi", then "le". Our accumulator in `src/agent.ts:17-82` waits for all these chunks to arrive and builds the full tool name and arguments. It's like waiting for someone to finish their sentence before you go and do what they asked.

### Tool Injection

When a tool finishes, we don't just print the result. We wrap it in a `tool_result` block and send it back to Claude as a new message. To Claude, it looks like he asked a question and we gave him the data he needed. This keeps the conversation flowing naturally for the AI.

## Design Decisions and Rationale

We decided to use the `stop_reason` from the API as the signal to run tools. If the API says `stop_reason: "tool_use"`, we know it's time to look at the content blocks and execute them. It's much more reliable than trying to guess if there's a tool call hidden in the text.

We set a `MAX_ITERATIONS` limit of 10 in `src/agent.ts:84-85`. It's a safety net. If Claude gets stuck in a loop where he keeps calling tools forever, this limit will stop him before he burns through your entire API budget.

Claude needs to remember what he's already seen so he doesn't keep asking for the same file over and over. We kept the tool results as part of the conversation history for this reason.

## Lessons Learned and Pitfalls

One tricky part was handling partial JSON. Sometimes the stream cuts off in the middle of a JSON object. Our accumulator has to be smart enough to wait for the `content_block_stop` event before trying to parse anything.

We also learned that error messages from tools are just as important as successful results. If a file doesn't exist, we send a clear error message back to Claude (`src/tools/read-file.ts:30-35`). He can then realize his mistake and maybe try a different file path instead of just crashing.

Testing the agent loop was a challenge. We had to mock the entire Anthropic API to simulate different scenarios, like Claude calling a tool that doesn't exist or hitting the iteration limit. You can see these tests in `src/__tests__/agent.test.ts:170-423`.

## How Good Engineers Think

Good engineers build for reliability. Using the official `stop_reason` and structured content blocks makes the agent much more reliable than if we had used "prompt engineering" to extract tool calls from plain text.

We also think about the "happy path" and the "error path" equally. Our `read_file` tool doesn't just throw an error if something goes wrong. It returns a structured `ToolResult` that the agent can understand and explain to the user.

Adding dozens of new tools becomes easy without changing a single line of the core loop logic. The agent loop doesn't care what the tools actually do. It just knows how to call them and pass the results back.

# Step 3: Editing and Searching

In Step 3, we gave our agent some serious power. We added the ability to write new files, edit existing ones, and search through the entire codebase. The agent starts to feel like a real pair programmer now.

## Technical Architecture

We expanded our toolbox with four new tools, each handling a specific part of the coding workflow.

Our `edit_file` tool in `src/tools/edit-file.ts` is the most complex. It avoids just overwriting a file. The tool looks for a specific block of text and replaces it with something new. It uses a `countOccurrences` helper (`src/tools/edit-file.ts:5-23`) to make sure the change is unambiguous.

For searching, we added `glob` and `grep`. The `glob` tool in `src/tools/glob.ts` uses Node's built-in file matching to find files by name. Our `grep` tool in `src/tools/grep.ts` searches through the actual content of your files using regular expressions.

Our `write_file` tool in `src/tools/write-file.ts` is straightforward but smart. It automatically creates any missing directories before writing the file (`src/tools/write-file.ts:25-28`). Claude doesn't have to worry about `mkdir` commands.

## Codebase Structure

Our `src/tools/` directory is now much busier.

* `src/tools/write-file.ts`: Handles creating and overwriting files.
* `src/tools/edit-file.ts`: Handles precise text replacements.
* `src/tools/glob.ts`: Handles finding files by pattern.
* `src/tools/grep.ts`: Handles searching for text within files.
* `src/tools/index.ts`: We registered all these new tools here so the agent can see them (`src/tools/index.ts:43-47`).

## Technologies and Why

We took advantage of some great features available in modern Node.js.

For the `glob` tool, we used the native `node:fs/promises` glob function (`src/tools/glob.ts:1`). This relatively new addition to Node replaces the need for external libraries like `glob` or `fast-glob`. The function is fast, built-in, and uses async iterators to keep memory usage low.

In the `grep` tool, we used a "regex-with-fallback" approach (`src/tools/grep.ts:7-14`). If Claude provides a valid regular expression, we use it. The tool becomes much more forgiving this way if the regex is invalid, as we fall back to a simple string search.

ASTs are powerful but also very heavy and language-specific. We chose a simple string-based replacement for `edit_file` instead of using complex AST parsing. This string-based approach works for any text file, whether it's TypeScript, Python, or even a README.

## Key Concepts Explained

### Unique Match Enforcement

When editing a file, we want to be absolutely sure we're changing the right thing. Our `edit_file` tool requires that the text you're looking for appears exactly once in the file (`src/tools/edit-file.ts:60-76`). The agent won't accidentally break your code by editing the wrong function because we refuse to make the change if it's not found or found multiple times.

### Slice-Based Replacement

Instead of using `string.replace()`, which can have weird behavior with special characters, we use `content.slice()` to surgically remove the old text and insert the new text (`src/tools/edit-file.ts:78-83`). It's a very deterministic way to handle strings. Every single space and newline is preserved exactly as intended.

### Robust Traversal

Our `grep` tool is designed to be "quietly reliable." If it runs into a file it can't read, like a binary file or a file with restricted permissions, it just skips it and moves on (`src/tools/grep.ts:71-99`). The entire search won't crash just because there's a `.DS_Store` file in your folder.

## Design Decisions and Rationale

We decided to use an `indexOf` loop for counting occurrences in `edit_file` instead of a global regex. This avoids any issues with escaping special regex characters and gives us the exact position of the match in a single pass.

For `write_file`, we chose to always use `recursive: true` when creating directories. The agent's life gets much easier because it can just say "write this to `src/components/Button.tsx`". Our tool handles all the folder creation automatically.

Most developers are used to the standard `file:line:content` format. We used this in `grep` because it gives Claude all the context he needs to understand where a match was found.

## Lessons Learned and Pitfalls

The "unique match" rule in `edit_file` is vital because it's easy for an AI to get confused by similar-looking code. An agent might otherwise try to edit a `render()` method and accidentally change five different components at once.

Searching large codebases can be slow. Using async iterators in our `glob` and `grep` tools ensures that we don't block the main thread while scanning hundreds of files.

We carefully added that `+1` in our `grep` tool. In the programming world, we usually count lines starting from 1, but arrays in JavaScript start at 0. The line numbers we show Claude now match what he sees in his editor.

## How Good Engineers Think

Good engineers build tools that are hard to misuse. Enforcing unique matches in `edit_file` creates a "safety rail" that prevents the agent from making catastrophic mistakes.

Our project stays lightweight and easier to maintain by using the built-in Node glob instead of an npm package. We value "zero-dependency" solutions when they make sense.

Finally, we think about the user experience for the AI. We provide clear, structured feedback for every tool call. If a search finds no results, we tell the agent "No matches found." The AI understands exactly what happened and can decide what to do next.

# Step 7: Memory That Lasts Longer Than the Terminal Window

Step 7 is where the agent stops being a goldfish. Up to now, every session lived and died inside one Node process. That works for a demo, but it is a terrible fit for real project work because the moment you close the terminal, the agent forgets your conventions, your recent progress, and the exact thread you were in. This phase fixes that by adding two separate kinds of persistence: durable memory and resumable session history.

## Technical Architecture

The core architectural move is separation of concerns. We now keep long-term project facts in one place and full chat transcripts in another.

`src/persistence/memory.ts:63-180` owns durable memory. It creates `.ai-agent/memory/index.json` plus one JSON file per memory entry in `.ai-agent/memory/entries/`. That means the index is optimized for lookup while each entry remains inspectable on disk.

`src/persistence/sessions.ts:77-137` owns session history. It writes a lossless transcript to `.ai-agent/sessions/<sessionId>.json` and a lighter summary to `.ai-agent/sessions/<sessionId>.summary.json`. That split is the key idea of the whole phase. Resume needs exact history. Fresh sessions need cheap context.

The REPL now has a bootstrap stage before the interactive loop even starts. `src/repl/bootstrap.ts:69-113` decides whether we are in a fresh session or a resumed one. Fresh sessions get a hidden bootstrap message that contains durable memories and recent session summaries. Resumed sessions get the full saved transcript back.

`src/repl.ts:69-221` stitches everything together. It loads bootstrap state, handles `/remember`, `/recall`, and `/forget` internally, rehydrates token counts on resume, and persists the session again on exit.

## Codebase Structure

This phase added a few new seams that are worth remembering:

* `src/persistence/memory.ts`: durable memory store and index-based lookup
* `src/persistence/sessions.ts`: session transcript and summary persistence
* `src/repl/commands.ts`: slash-command router for status and memory operations
* `src/repl/bootstrap.ts`: fresh-session vs resumed-session bootstrap logic
* `src/cli/app.ts`: testable CLI startup wrapper, separate from the terminal entrypoint

That structure is not accidental. We deliberately refused to bury persistence logic directly inside `src/repl.ts`. Good engineers treat "filesystem persistence," "session boot logic," and "terminal I/O" as different jobs because they change for different reasons.

## Technologies and Why

We stayed simple on purpose.

We used plain JSON files instead of SQLite or a vector database. That is the right call here. You can open the files yourself, debug them with `cat`, and reason about the system without adding another service or binary.

We used token-overlap matching for memory recall in `src/persistence/memory.ts:36-45` and `src/persistence/memory.ts:122-160`. Fancy retrieval systems are tempting, but premature cleverness is how small tools become fragile science projects. The simple approach is good enough for this phase and keeps the behavior explainable.

We kept memory operations out of the model tool catalog. Instead, `src/repl/commands.ts:34-80` handles `/remember`, `/recall`, and `/forget` as explicit user commands. That is a product decision disguised as an implementation detail. It keeps the human in charge of what becomes durable.

## Lessons Learned

The biggest lesson is that "stored on disk" is not a single concept. A transcript is not memory. A summary is not a transcript. If you collapse those ideas together, the UX becomes mushy and the deletion rules become dangerous.

Another lesson is that lifecycle boundaries matter. Resume happens at CLI startup in `src/cli.ts:23-45`, not halfway through a running REPL. That avoids a whole class of state bugs where you would otherwise be swapping history, token counts, and session ids mid-flight.

There is also a subtle practical lesson here: generated agent artifacts should not quietly creep into git. That is why we added `.ai-agent/memory/` and `.ai-agent/sessions/` to `.gitignore`. Small hygiene decisions like that save you from noisy diffs later.

## How Good Engineers Think

Good engineers do not just ask, "Can I persist this?" They ask, "What kind of thing is this, and what lifecycle should it have?" That question gave us the whole phase.

Durable memories are curated facts. Session transcripts are exact conversation state. Session summaries are compressed breadcrumbs for future work. Each one exists because it serves a different operational need.

This is also a nice example of test-driven architecture. We wrote one failing anchor test for every Step 7 spec scenario first. That forced the implementation to grow along stable seams instead of becoming one giant `repl.ts` blob with filesystem calls sprinkled everywhere.
