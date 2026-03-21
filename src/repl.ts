import { createInterface } from "node:readline/promises";
import chalk from "chalk";

import { AnthropicError, streamMessage } from "./api/anthropic.js";
import type { Message } from "./api/anthropic.js";

const SYSTEM_PROMPT =
  "You are an AI coding assistant. You help users with programming questions, debug code, and write new code. Be concise and provide working code examples when appropriate.";
const MODEL = "claude-sonnet-4-20250514";
const PROMPT = "> ";
const EXIT_COMMANDS = new Set(["exit", "quit"]);

export function isExitCommand(input: string): boolean {
  return EXIT_COMMANDS.has(input.trim().toLowerCase());
}

export function isEmptyInput(input: string): boolean {
  return input.trim() === "";
}

export async function startRepl(apiKey: string): Promise<void> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const messages: Message[] = [];

  const handleSigint = (): void => {
    process.stdout.write("\n");
    console.log(chalk.cyan("Goodbye!"));
    rl.close();
    process.exit(0);
  };

  process.on("SIGINT", handleSigint);

  console.log(chalk.cyan("AI Coding Agent"));
  console.log(chalk.dim('Type "exit" or "quit" to leave.\n'));

  try {
    while (true) {
      const input = await rl.question(PROMPT);
      const trimmed = input.trim();

      if (isEmptyInput(input)) {
        continue;
      }

      if (isExitCommand(input)) {
        console.log(chalk.cyan("Goodbye!"));
        rl.close();
        process.exit(0);
      }

      messages.push({ role: "user", content: trimmed });

      try {
        const stream = streamMessage({
          messages,
          model: MODEL,
          apiKey,
          system: SYSTEM_PROMPT,
        });

        let assistantText = "";
        for await (const event of stream) {
          if (event.type === "content_block_delta") {
            process.stdout.write(event.delta.text);
            assistantText += event.delta.text;
          }
        }

        process.stdout.write("\n");
        messages.push({ role: "assistant", content: assistantText });
      } catch (error: unknown) {
        process.stdout.write("\n");

        if (error instanceof AnthropicError) {
          if (error.statusCode) {
            console.error(chalk.red(`API error (${error.statusCode}): ${error.message}`));
          } else {
            console.error(chalk.red(`Error: ${error.message}`));
          }
          continue;
        }

        const message = error instanceof Error ? error.message : String(error);
        console.error(chalk.red(`Error: ${message}`));
      }
    }
  } finally {
    process.off("SIGINT", handleSigint);
    rl.close();
  }
}
