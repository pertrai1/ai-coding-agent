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
