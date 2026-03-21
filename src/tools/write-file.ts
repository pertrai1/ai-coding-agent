import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import type { ToolRegistration, ToolResult } from "./index.js";

async function execute(input: Record<string, unknown>): Promise<ToolResult> {
  const filePath = input.filePath;

  if (typeof filePath !== "string" || filePath.length === 0) {
    return {
      content: "Error: filePath is required and must be a string.",
      isError: true,
    };
  }

  const fileContent = input.content;

  if (typeof fileContent !== "string") {
    return {
      content: "Error: content is required and must be a string.",
      isError: true,
    };
  }

  try {
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, fileContent, "utf-8");
    return { content: `Successfully wrote to ${filePath}` };
  } catch (error: unknown) {
    if (error instanceof Error) {
      const nodeError = error as NodeJS.ErrnoException;

      if (nodeError.code === "EACCES") {
        return {
          content: `Error: Permission denied: ${filePath}`,
          isError: true,
        };
      }

      if (nodeError.code === "EISDIR") {
        return {
          content: `Error: Path is a directory, not a file: ${filePath}`,
          isError: true,
        };
      }

      return {
        content: `Error writing file ${filePath}: ${error.message}`,
        isError: true,
      };
    }

    return {
      content: `Error writing file ${filePath}: ${String(error)}`,
      isError: true,
    };
  }
}

export const writeFileTool: ToolRegistration = {
  definition: {
    name: "write_file",
    description:
      "Create a new file or overwrite an existing file with the provided content. Creates parent directories automatically if they don't exist.",
    input_schema: {
      type: "object",
      properties: {
        filePath: {
          type: "string",
          description:
            "The absolute or relative path of the file to write.",
        },
        content: {
          type: "string",
          description: "The full content to write to the file.",
        },
      },
      required: ["filePath", "content"],
    },
  },
  execute,
};
