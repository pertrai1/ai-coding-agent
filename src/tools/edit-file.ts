import { readFile, writeFile } from "node:fs/promises";

import type { ToolRegistration, ToolResult } from "./index.js";

function countOccurrences(
  content: string,
  searchText: string,
): { count: number; firstIndex: number } {
  let count = 0;
  let firstIndex = -1;
  let startPos = 0;

  while (true) {
    const index = content.indexOf(searchText, startPos);
    if (index === -1) break;

    count++;
    if (count === 1) firstIndex = index;
    startPos = index + searchText.length;
  }

  return { count, firstIndex };
}

async function execute(input: Record<string, unknown>): Promise<ToolResult> {
  const filePath = input.filePath;

  if (typeof filePath !== "string" || filePath.length === 0) {
    return {
      content: "Error: filePath is required and must be a string.",
      isError: true,
    };
  }

  const findText = input.findText;

  if (typeof findText !== "string") {
    return {
      content: "Error: findText is required and must be a string.",
      isError: true,
    };
  }

  if (findText.length === 0) {
    return {
      content: "Error: findText must not be empty.",
      isError: true,
    };
  }

  const replaceText = input.replaceText;

  if (typeof replaceText !== "string") {
    return {
      content: "Error: replaceText is required and must be a string.",
      isError: true,
    };
  }

  try {
    const content = await readFile(filePath, "utf-8");
    const { count, firstIndex } = countOccurrences(content, findText);

    if (count === 0) {
      return {
        content: `Error: The specified text was not found in ${filePath}.`,
        isError: true,
      };
    }

    if (count > 1) {
      return {
        content: `Error: Found ${count} matches for the specified text in ${filePath}. Provide more surrounding context to uniquely identify the edit location.`,
        isError: true,
      };
    }

    const updated =
      content.slice(0, firstIndex) +
      replaceText +
      content.slice(firstIndex + findText.length);

    await writeFile(filePath, updated, "utf-8");

    return {
      content: `Successfully edited ${filePath}. Replaced 1 occurrence.`,
    };
  } catch (error: unknown) {
    if (error instanceof Error) {
      const nodeError = error as NodeJS.ErrnoException;

      if (nodeError.code === "ENOENT") {
        return {
          content: `Error: File not found: ${filePath}`,
          isError: true,
        };
      }

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
        content: `Error editing file ${filePath}: ${error.message}`,
        isError: true,
      };
    }

    return {
      content: `Error editing file ${filePath}: ${String(error)}`,
      isError: true,
    };
  }
}

export const editFileTool: ToolRegistration = {
  permission: "prompt",
  definition: {
    name: "edit_file",
    description:
      "Make a targeted edit to an existing file by finding and replacing a specific piece of text. The findText must match exactly one location in the file. If it matches zero or multiple locations, the edit is rejected.",
    input_schema: {
      type: "object",
      properties: {
        filePath: {
          type: "string",
          description:
            "The absolute or relative path of the file to edit.",
        },
        findText: {
          type: "string",
          description:
            "The exact text to find in the file. Must match exactly one location.",
        },
        replaceText: {
          type: "string",
          description:
            "The text to replace the found text with. Use an empty string to delete the matched text.",
        },
      },
      required: ["filePath", "findText", "replaceText"],
    },
  },
  execute,
};
