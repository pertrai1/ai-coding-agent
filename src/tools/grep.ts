import { readFile, stat } from "node:fs/promises";
import { glob as fsGlob } from "node:fs/promises";
import { join, resolve } from "node:path";

import type { ToolRegistration, ToolResult } from "./index.js";

function buildMatcher(pattern: string): (line: string) => boolean {
  try {
    const regex = new RegExp(pattern);
    return (line: string) => regex.test(line);
  } catch {
    return (line: string) => line.includes(pattern);
  }
}

async function searchFile(
  filePath: string,
  matcher: (line: string) => boolean,
): Promise<string[]> {
  try {
    const content = await readFile(filePath, "utf-8");
    const lines = content.split("\n");
    const matches: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      if (matcher(lines[i])) {
        matches.push(`${filePath}:${i + 1}:${lines[i]}`);
      }
    }

    return matches;
  } catch {
    // Skip unreadable files (binary, permission denied, etc.)
    return [];
  }
}

async function execute(input: Record<string, unknown>): Promise<ToolResult> {
  const pattern = input.pattern;

  if (typeof pattern !== "string" || pattern.length === 0) {
    return {
      content: "Error: pattern is required and must be a non-empty string.",
      isError: true,
    };
  }

  const searchPath = input.path;

  if (searchPath !== undefined && typeof searchPath !== "string") {
    return {
      content: "Error: path must be a string.",
      isError: true,
    };
  }

  const include = input.include;

  if (include !== undefined && typeof include !== "string") {
    return {
      content: "Error: include must be a string.",
      isError: true,
    };
  }

  const matcher = buildMatcher(pattern);
  const targetPath =
    typeof searchPath === "string" ? resolve(searchPath) : process.cwd();

  try {
    const pathStat = await stat(targetPath);
    const allMatches: string[] = [];

    if (pathStat.isFile()) {
      const matches = await searchFile(targetPath, matcher);
      allMatches.push(...matches);
    } else if (pathStat.isDirectory()) {
      const globPattern =
        typeof include === "string" ? include : "**/*";

      const files: string[] = [];

      for await (const entry of fsGlob(globPattern, { cwd: targetPath })) {
        files.push(entry);
      }

      for (const file of files) {
        const fullPath = join(targetPath, file);

        try {
          const fileStat = await stat(fullPath);
          if (fileStat.isFile()) {
            const matches = await searchFile(fullPath, matcher);
            allMatches.push(...matches);
          }
        } catch {
          // Skip files we can't stat
        }
      }
    } else {
      return {
        content: `Error: Path is neither a file nor a directory: ${targetPath}`,
        isError: true,
      };
    }

    if (allMatches.length === 0) {
      return { content: "No matches found." };
    }

    return { content: allMatches.join("\n") };
  } catch (error: unknown) {
    if (error instanceof Error) {
      const nodeError = error as NodeJS.ErrnoException;

      if (nodeError.code === "ENOENT") {
        return {
          content: `Error: Path not found: ${targetPath}`,
          isError: true,
        };
      }

      if (nodeError.code === "EACCES") {
        return {
          content: `Error: Permission denied: ${targetPath}`,
          isError: true,
        };
      }

      return {
        content: `Error running grep: ${error.message}`,
        isError: true,
      };
    }

    return {
      content: `Error running grep: ${String(error)}`,
      isError: true,
    };
  }
}

export const grepTool: ToolRegistration = {
  permission: "allow",
  definition: {
    name: "grep",
    description:
      "Search file contents for a pattern and return matching lines with file paths and line numbers. Searches recursively when given a directory. Supports regex patterns with automatic fallback to literal string matching for invalid regex.",
    input_schema: {
      type: "object",
      properties: {
        pattern: {
          type: "string",
          description:
            "The search pattern (regex or plain text). Invalid regex patterns will be treated as literal strings.",
        },
        path: {
          type: "string",
          description:
            "File or directory to search. Defaults to the current working directory.",
        },
        include: {
          type: "string",
          description:
            "Glob pattern to filter which files to search (e.g., '*.ts'). Only applies when searching a directory.",
        },
      },
      required: ["pattern"],
    },
  },
  execute,
};
