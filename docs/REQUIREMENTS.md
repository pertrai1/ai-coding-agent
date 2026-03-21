# The Challenge - Building Your Own AI Coding Agent

You’re going to build a command-line AI coding agent, a simplified version of tools like Claude Code, Codex and AmpCode. It starts as a simple chat interface, and step by step you’ll add the ability to read files, edit code, run shell commands, search a codebase and manage context. By the end, you’ll have a working agent that can navigate a real project and make meaningful changes to it.

To really get the most from this challenge I suggest you call the LLM provider’s REST API directly and manage all the data yourself, this will give you the best understanding of AI agents and how they work.

## Step Zero

In this introductory step you’re going to set your environment up ready to begin developing and testing your solution.

You’ll need to make a few decisions:

- **Choose your LLM provider**. You need a model that supports tool calling (also called function calling). Most major providers support this: Anthropic, OpenAI, Google (Gemini), Mistral, or local models via Ollama. Check your chosen provider’s documentation for their tool-calling API - you’ll be using it heavily throughout this challenge. **Anthropic will be used for this project**
- **Choose your programming language**. Pick something you’re comfortable building CLI tools in. You’ll be doing a fair amount of file I/O, process spawning, and JSON handling. Python, TypeScript, Go, and Rust all work well. **TypeScript will be used for this project**
- **Get your API key set up**. Make sure you can make a basic chat completion request to your chosen provider and get a response back before moving on.
  Prepare a small test project to use as a playground throughout the challenge - a simple application with a few files in a couple of directories. You’ll be pointing your agent at this project to test reading, editing, and searching. **I have API key and will use in .env file**

Testing: Make a simple API call to your LLM provider with a basic prompt like “Hello, who are you?” and verify you get a coherent response. If you’re using a local model, confirm it’s running and accessible. I suggest using curl to do this so you know how to call the REST API for your provider.

## Step 1

In this step your goal is to build the core agentic loop with streaming responses.

The heart of any coding agent is the loop: read user input, send it to the LLM, display the response, repeat. Build a REPL (read-eval-print loop) that takes input from the terminal, sends it to your LLM as a chat message, and streams the response back to the terminal as it arrives.

Streaming matters here. LLM responses can take several seconds to generate in full, and watching text appear token by token is a much better experience than staring at a blank screen. Your provider’s API will have a streaming option - use it.

Your loop should maintain a conversation history so the model has context from earlier in the session. Each time you send a request, include the full conversation so far: all previous user messages and assistant responses.

Handle the basics gracefully: let the user exit the session cleanly, and don’t crash if the API returns an error.

Testing:

- Start your agent and have a multi-turn conversation. Ask a question, then ask a follow-up that references the previous answer. The model should understand the context.
- Verify responses stream to the terminal incrementally rather than appearing all at once.
- Check that you can exit the session cleanly (e.g. with Ctrl+C or typing “quit” or “exit”).
- Disconnect from the network and send a message - verify the agent handles the error without crashing.

## Step 2

In this step your goal is to add tool calling and implement file reading as your first tool.

Tool calling is what turns a chatbot into an agent. Instead of just generating text, the model can request to call a function - read a file, run a command, search for something - and your agent executes it and feeds the result back. The model then uses that result to continue its response.

Define a tool interface that your LLM can call. The exact format depends on your provider, but typically you describe each tool with a name, a description, and a JSON schema for its parameters. Start with a single tool: read_file, which takes a file path and returns the file’s contents.

The agentic loop now becomes: send the conversation to the LLM. If the response includes a tool call, execute it, append the result to the conversation, and send it back to the LLM. Keep looping until the model responds with text instead of a tool call. The model might chain several tool calls before giving a final answer - your loop should handle that naturally.

Testing:

- Ask your agent “What’s in the file README.md?” (or any file in your test project). It should call the read_file tool, receive the contents, and summarise or discuss the file.
- Ask it about a file that doesn’t exist. The tool should return an error, and the model should explain that the file wasn’t found rather than crashing.
- Ask a question that requires reading multiple files. The model should make multiple tool calls in sequence to gather the information it needs.
- Ask a question that doesn’t need any file reading (e.g. “What is a binary tree?”). The model should answer directly without calling any tools.

## Step 3

In this step your goal is to add file editing and codebase search tools.

A coding agent that can only read files isn’t much use - it needs to be able to make changes too. Add an edit_file tool that applies a targeted edit to a file. A good approach is to have the tool take the file path, the text to find, and the text to replace it with. This is safer than having the model rewrite entire files, which is both slow and error-prone.

Also add a write_file tool for creating new files. This takes a file path and the full content to write.

Next, add two search tools so the agent can navigate unfamiliar code. A glob tool that finds files matching a pattern (e.g. **/\*.py, src/**/\*.ts) and a grep tool that searches file contents for a pattern and returns matching lines with file paths and line numbers.

With these five tools - read, edit, write, glob, and grep - your agent can explore and modify a codebase in a meaningful way.

Testing:

- Ask your agent to add a comment to a specific function in your test project. It should read the file, make a targeted edit, and confirm the change. Open the file and verify the edit is correct.
- Ask it to create a new file with some content. Verify the file is created with the correct contents.
- Ask it to find all Python (or whatever language your test project uses) files in the project. It should use the glob tool and return the list.
- Ask it to find where a specific function or variable is used across the codebase. It should use the grep tool to search.
- Ask it to refactor something - rename a variable or extract a function. This should require multiple tool calls: search to find usages, then edit each one.

## Step 4

In this step your goal is to add shell command execution and a permission system.

Shell access makes your agent dramatically more capable. It can run tests, install dependencies, check build output, and interact with any command-line tool. Add a bash tool that takes a command string, executes it in a shell, and returns the stdout, stderr, and exit code.

But with great power comes the need for guardrails. You don’t want your agent silently running rm -rf / because the model hallucinated a cleanup step. Implement a permission system that controls which actions the agent can take without asking.

Your permission system should support at least three modes for each tool: allow (execute without asking), prompt (ask the user for confirmation before executing), and deny (never execute). A sensible default is to allow read-only operations (file reading, glob, grep) automatically, prompt for mutations (file edits, shell commands), and let the user configure overrides.

When a tool call requires confirmation, display the tool name and its arguments clearly and wait for the user to approve or reject before proceeding.

Testing:

- Ask your agent to run the test suite for your test project. It should use the bash tool to execute the appropriate test command and report the results.
- Verify that shell commands require your approval before running (assuming you’ve set bash to “prompt” mode).
- Deny a shell command when prompted and verify the agent adapts gracefully - it should acknowledge that you declined and try an alternative approach or explain what it was trying to do.
- Configure file reading to “allow” and verify those calls execute without prompting.
- Ask the agent to do something that involves both allowed and prompted tools in sequence. Verify the allowed tools execute silently and the prompted ones ask for confirmation.

## Step 5

In this step your goal is to add context window management so your agent can handle long sessions without breaking.

Every LLM has a context window limit, and coding sessions can generate a lot of content. Reading a few large files, running some commands, and having a back-and-forth conversation can fill up the context quickly. When you hit the limit, your API calls will fail.

Implement a strategy to manage this. A practical approach is conversation compression (aka compaction): when the conversation history approaches the context limit, summarise the older messages into a condensed form and keep only the recent messages intact. The summary preserves the key decisions, findings, and context from earlier in the conversation without using as many tokens. Most agents use a call to the LLM to generate the summary. Make that call in the background and don’t show the user.

You’ll need to track token usage. Most providers return token counts in their API responses. Keep a running total and trigger compression when you’re approaching the limit - leaving enough headroom for the model’s response.

After compression, the conversation should continue to work naturally. The model should still understand what it was doing and what decisions were made earlier, even if it can’t see the exact messages from the beginning of the session.

Testing:

- Have a long session with your agent where you read several large files and have an extended conversation. Verify it doesn’t crash when the context gets large.
- After compression has occurred, ask the agent to recall something from earlier in the conversation. It should still have the key information from the summary.
- Check your token tracking by asking the agent how much of the context window has been used (you might expose this in a status command or similar).
- Verify that tool calls still work correctly after compression - the model should still know which tools are available and how to use them.

## Step 6

In this step your goal is to add project context loading and a configuration file hierarchy.

A good coding agent should understand the project it’s working in without being told everything from scratch. Add support for a project instruction file - a markdown file in the project root (e.g. AGENTS.md or CLAUDE.md I suggest you use AGENTS.md) that contains project-specific context. When the agent starts, it should look for this file and include its contents in the system prompt.

This file might contain information like the project’s architecture, coding conventions, how to run tests, which directories contain what, or anything else that would help the agent be more effective. The contents of this file are added to the context sent to the LLM as one of the first user messages.

Next, implement a configuration file hierarchy. Settings should cascade from three levels: global (user-wide defaults, e.g. in a home directory dotfile), project-level (in the project root), and local (for personal overrides that aren’t committed to source control). More specific settings override more general ones.

The configuration should cover at least: the default LLM provider and model, permission defaults for each tool, and any custom system prompt additions.

Testing:

- Create an AGENTS.md file in your test project with some specific instructions (e.g. “Always use snake_case for variable names” or “Run tests with pytest“). Ask the agent to make a change and verify it follows the project instructions.
- Verify the agent works fine when no project instruction file exists - it should carry on without error.
- Set up global and project-level configuration files with different values for the same setting. Verify the project-level setting takes precedence.
- Add a local configuration override and verify it takes precedence over both project and global settings.

## Step 7

In this step your goal is to add persistent memory so your agent remembers context across sessions and conversation history so you can resume previous sessions.

Without persistence, every session starts from zero. If you told the agent about your project’s architecture yesterday, it’s forgotten it today. Implement a memory system that lets the agent store and retrieve information across sessions.

A file-based approach works well: the agent writes memories to a designated directory as individual files, with an index that tracks what’s stored. Memories might include things the user has asked the agent to remember, project decisions, or user preferences. When a new session starts, the agent loads relevant memories to inform its behaviour.

Also add conversation history persistence. Save completed sessions so the user can resume a previous conversation with its full context intact, or start a new session that has access to a summary of past work. Again use the LLM to generate summaries.

Testing:

- Tell your agent to remember something specific (e.g. “Remember that our API uses JWT authentication”). End the session, start a new one, and ask a question where that context is relevant. The agent should use the stored memory in its response.
- Ask the agent what it remembers. It should be able to list or describe its stored memories.
- Tell the agent to forget something it previously stored. Verify it’s removed.
- End a session, then resume it. The conversation context should be intact.
- Start a fresh session and verify it doesn’t carry over the conversation history from the previous one (though memories should still be accessible).

## Step 8

In this step your goal is to add subagent support and plan mode.

Some tasks benefit from being broken down and worked on in parallel, or from being planned before implementation begins. Add the ability for your agent to spawn subagents - separate agent instances that work on a specific subtask and report back.

A subagent should have its own conversation with the LLM, its own context, and access to the same tools as the main agent. The main agent describes a task, the subagent works on it independently, and returns a result. This is useful for things like “search the codebase for all usages of this pattern” or “read these five files and summarise what they do” - tasks that would clutter the main conversation with tool calls.

Also add a plan mode. When activated, the agent switches to an architect role: it reads code, asks questions, and produces a plan, but doesn’t make any changes. Once the user approves the plan, the agent switches back to implementation mode and follows the plan. This is valuable for larger tasks where you want to review the approach before any code is modified. Plan mode will often benefit from a reduced toolset and a customised system prompt.

Testing:

- Ask your agent to do something that benefits from subagents, like “summarise all the files in the src directory”. Verify it spawns subagents and combines their results.
- Verify that subagent work doesn’t pollute the main conversation - the main agent should present a clean summary.
- Activate plan mode and ask the agent to implement a feature. Verify it produces a plan without making any changes.
- Approve the plan and verify the agent implements it.
- Reject or modify the plan and verify the agent adapts.

## Going Further

You’ve built a working AI coding agent. Here are some ways to push it further:

- Model Context Protocol (MCP): Add support for MCP, which lets your agent connect to external tool servers. This means anyone can extend your agent’s capabilities by writing an MCP server, without modifying the agent itself.
- Skills System: Add the ability to define reusable skills - pre-written prompts and tool configurations that can be invoked by name. For example, a commit skill that knows how to stage changes and create a well-formatted commit, or a review skill that analyses code for issues.
- Hooks: Let users define shell commands that trigger on agent events - before a tool executes, after a file is edited, when a session starts. This enables custom workflows like running a linter automatically after every file edit.
- Model Selection: Support switching between different models mid-session. Some tasks need the most capable model available, while others can use a faster, cheaper one.
- Headless Mode: Add a non-interactive mode where the agent receives a prompt, executes it, and exits. This enables CI/CD integration and scripted automation.
