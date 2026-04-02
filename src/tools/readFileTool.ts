import { readFile } from "node:fs/promises";

import type { ToolRegistration, ToolResult } from "./index.js";

function classifyReadError(error: unknown, filePath: string): ToolResult {
  if (error instanceof Error) {
    const nodeError = error as NodeJS.ErrnoException;

    if (nodeError.code === "ENOENT") {
      return { content: `Error: File not found: ${filePath}`, isError: true };
    }

    if (nodeError.code === "EACCES") {
      return { content: `Error: Permission denied: ${filePath}`, isError: true };
    }

    if (nodeError.code === "EISDIR") {
      return { content: `Error: Path is a directory, not a file: ${filePath}`, isError: true };
    }

    return { content: `Error reading file ${filePath}: ${error.message}`, isError: true };
  }

  return { content: `Error reading file ${filePath}: ${String(error)}`, isError: true };
}

async function execute(input: Record<string, unknown>): Promise<ToolResult> {
  const filePath = input.filePath;

  if (typeof filePath !== "string" || filePath.length === 0) {
    return { content: "Error: filePath is required and must be a string.", isError: true };
  }

  try {
    const content = await readFile(filePath, "utf-8");
    return { content };
  } catch (error: unknown) {
    return classifyReadError(error, filePath);
  }
}

export const readFileTool: ToolRegistration = {
  permission: "allow",
  definition: {
    name: "read_file",
    description:
      "Read the contents of a file from disk. Returns the full text content of the file at the given path.",
    input_schema: {
      type: "object",
      properties: {
        filePath: {
          type: "string",
          description: "The absolute or relative path of the file to read.",
        },
      },
      required: ["filePath"],
    },
  },
  execute,
};
