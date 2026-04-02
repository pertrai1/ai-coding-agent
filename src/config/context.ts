import { readFileSync } from "node:fs";
import { join } from "node:path";

export function loadProjectInstructions(cwd: string): string | null {
  const filePath = join(cwd, "AGENTS.md");
  try {
    return readFileSync(filePath, "utf-8");
  } catch (error: unknown) {
    const isNotFound = error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === "ENOENT";
    if (!isNotFound) {
      console.warn("Warning: could not read AGENTS.md", { error: error instanceof Error ? error.message : String(error) });
    }
    return null;
  }
}

export function assembleSystemPrompt(
  base: string,
  projectInstructions: string | null,
  extraPrompt: string | undefined,
): string {
  const parts: string[] = [base];

  if (projectInstructions) {
    parts.push(`<project-instructions>\n${projectInstructions}\n</project-instructions>`);
  }

  if (extraPrompt) {
    parts.push(extraPrompt);
  }

  return parts.join("\n\n");
}
