import { createInterface } from "node:readline/promises";
import chalk from "chalk";

import { AnthropicError } from "./api/anthropic.js";
import type { Message } from "./api/anthropic.js";
import { runAgentLoop } from "./agent.js";
import { createToolRegistry } from "./tools/index.js";

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

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

function formatToolInput(toolName: string, toolInput: Record<string, unknown>): string {
  const lines: string[] = [];
  for (const [key, value] of Object.entries(toolInput)) {
    const display = typeof value === "string" && value.length > 120
      ? value.slice(0, 120) + "..."
      : String(value);
    lines.push(`  ${key}: ${display}`);
  }
  return lines.join("\n");
}

function createPromptForApproval(
  rl: ReturnType<typeof createInterface>,
): (toolName: string, toolInput: Record<string, unknown>) => Promise<boolean> {
  return async (toolName: string, toolInput: Record<string, unknown>): Promise<boolean> => {
    process.stdout.write("\n");
    console.log(chalk.yellow(`⚡ Tool: ${toolName}`));
    console.log(chalk.dim(formatToolInput(toolName, toolInput)));
    const answer = await rl.question(chalk.yellow("  Allow? (y/n): "));
    return answer.trim().toLowerCase() === "y";
  };
}

export async function startRepl(apiKey: string): Promise<void> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const messages: Message[] = [];
  const toolRegistry = createToolRegistry();
  const promptForApproval = createPromptForApproval(rl);

  console.log(chalk.cyan("AI Coding Agent"));
  console.log(chalk.dim('Type "exit" or "quit" to leave.\n'));

  try {
    while (true) {
      let input: string;
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

      const trimmed = input.trim();

      if (isEmptyInput(input)) {
        continue;
      }

      if (isExitCommand(input)) {
        console.log(chalk.cyan("Goodbye!"));
        return;
      }

      messages.push({
        role: "user",
        content: [{ type: "text", text: trimmed }],
      });

      try {
        await runAgentLoop({
          messages,
          toolRegistry,
          model: MODEL,
          apiKey,
          system: SYSTEM_PROMPT,
          write: (text) => process.stdout.write(text),
          promptForApproval,
        });

        process.stdout.write("\n");
      } catch (error: unknown) {
        process.stdout.write("\n");

        if (isAbortError(error)) {
          console.log(chalk.cyan("Goodbye!"));
          return;
        }

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
    rl.close();
  }
}
