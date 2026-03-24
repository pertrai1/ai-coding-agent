import { glob as fsGlob } from "node:fs/promises";
import { resolve } from "node:path";

import type { ToolRegistration, ToolResult } from "./index.js";

async function execute(input: Record<string, unknown>): Promise<ToolResult> {
  const pattern = input.pattern;

  if (typeof pattern !== "string" || pattern.length === 0) {
    return {
      content: "Error: pattern is required and must be a non-empty string.",
      isError: true,
    };
  }

  const basePath = input.path;

  if (basePath !== undefined && typeof basePath !== "string") {
    return {
      content: "Error: path must be a string.",
      isError: true,
    };
  }

  const cwd = typeof basePath === "string" ? resolve(basePath) : process.cwd();

  try {
    const results: string[] = [];

    for await (const entry of fsGlob(pattern, { cwd })) {
      results.push(entry);
    }

    if (results.length === 0) {
      return { content: "No files matched the pattern." };
    }

    return { content: results.join("\n") };
  } catch (error: unknown) {
    if (error instanceof Error) {
      const nodeError = error as NodeJS.ErrnoException;

      if (nodeError.code === "ENOENT") {
        return {
          content: `Error: Directory not found: ${cwd}`,
          isError: true,
        };
      }

      return {
        content: `Error running glob: ${error.message}`,
        isError: true,
      };
    }

    return {
      content: `Error running glob: ${String(error)}`,
      isError: true,
    };
  }
}

export const globTool: ToolRegistration = {
  permission: "allow",
  definition: {
    name: "glob",
    description:
      "Find files matching a glob pattern. Returns a newline-separated list of matching file paths. Supports patterns like **/*.ts, src/**/*.js, etc.",
    input_schema: {
      type: "object",
      properties: {
        pattern: {
          type: "string",
          description:
            "The glob pattern to match files against (e.g., '**/*.ts', 'src/**/*.js').",
        },
        path: {
          type: "string",
          description:
            "Optional base directory to search from. Defaults to the current working directory.",
        },
      },
      required: ["pattern"],
    },
  },
  execute,
};
