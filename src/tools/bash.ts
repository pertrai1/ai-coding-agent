import { execFile } from "node:child_process";
import { promisify } from "node:util";

import type { ToolRegistration, ToolResult } from "./index.js";

const execFileAsync = promisify(execFile);

function formatOutput(stdout: string, stderr: string, exitCode: number): string {
  return `stdout:\n${stdout}\nstderr:\n${stderr}\nexit code:\n${exitCode}`;
}

async function execute(input: Record<string, unknown>): Promise<ToolResult> {
  const command = input.command;

  if (typeof command !== "string" || command.length === 0) {
    return {
      content: "Error: command is required and must be a non-empty string.",
      isError: true,
    };
  }

  try {
    const { stdout, stderr } = await execFileAsync("/bin/sh", ["-c", command]);
    return { content: formatOutput(stdout, stderr, 0) };
  } catch (error: unknown) {
    if (
      error instanceof Error &&
      "stdout" in error &&
      "stderr" in error &&
      "code" in error
    ) {
      const execError = error as { stdout: string; stderr: string; code: number };
      return {
        content: formatOutput(execError.stdout, execError.stderr, execError.code),
        isError: true,
      };
    }

    const message = error instanceof Error ? error.message : String(error);
    return {
      content: `Error executing command: ${message}`,
      isError: true,
    };
  }
}

export const bashTool: ToolRegistration = {
  permission: "prompt",
  definition: {
    name: "bash",
    description:
      "Execute a shell command and return its stdout, stderr, and exit code. The command is run via /bin/sh.",
    input_schema: {
      type: "object",
      properties: {
        command: {
          type: "string",
          description: "The shell command to execute.",
        },
      },
      required: ["command"],
    },
  },
  execute,
};
