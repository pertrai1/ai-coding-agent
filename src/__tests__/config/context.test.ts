import { mkdtemp, rm, writeFile, chmod } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  loadProjectInstructions,
  assembleSystemPrompt,
} from "../../config/context.js";

describe("loadProjectInstructions", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "context-test-"));
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  // Spec: project-context > Load AGENTS.md > "AGENTS.md exists and is loaded"
  it("reads AGENTS.md content when the file exists", async () => {
    await writeFile(join(tempDir, "AGENTS.md"), "Follow the coding standards.");

    const result = loadProjectInstructions(tempDir);

    expect(result).toBe("Follow the coding standards.");
  });

  // Spec: project-context > Load AGENTS.md > "AGENTS.md does not exist"
  it("returns null when AGENTS.md does not exist", () => {
    const result = loadProjectInstructions(tempDir);

    expect(result).toBeNull();
  });

  // Spec: project-context > Load AGENTS.md > "AGENTS.md read error"
  it("returns null and logs a warning when AGENTS.md cannot be read", async () => {
    const filePath = join(tempDir, "AGENTS.md");
    await writeFile(filePath, "content");
    await chmod(filePath, 0o000);

    const result = loadProjectInstructions(tempDir);

    expect(result).toBeNull();
    expect(console.warn).toHaveBeenCalledWith(
      "Warning: could not read AGENTS.md",
      expect.objectContaining({ error: expect.stringContaining("EACCES") }),
    );

    // Restore permissions for cleanup
    await chmod(filePath, 0o644);
  });
});

describe("assembleSystemPrompt", () => {
  const BASE = "You are an AI coding assistant.";

  // Spec: project-context > Inject project instructions > "Project instructions appear in system prompt"
  // Spec: repl-chat-loop > System prompt > "System prompt with all sources"
  it("assembles base + project instructions + extra prompt when all present", () => {
    const result = assembleSystemPrompt(
      BASE,
      "Follow the coding standards.",
      "Always explain your reasoning.",
    );

    expect(result).toContain(BASE);
    expect(result).toContain("<project-instructions>");
    expect(result).toContain("Follow the coding standards.");
    expect(result).toContain("</project-instructions>");
    expect(result).toContain("Always explain your reasoning.");

    // Verify ordering: base before project instructions before extra
    const baseIdx = result.indexOf(BASE);
    const instrIdx = result.indexOf("<project-instructions>");
    const extraIdx = result.indexOf("Always explain your reasoning.");
    expect(baseIdx).toBeLessThan(instrIdx);
    expect(instrIdx).toBeLessThan(extraIdx);
  });

  // Spec: project-context > Inject project instructions > "System prompt without project instructions"
  // Spec: repl-chat-loop > System prompt > "System prompt with no project instructions or extra text"
  it("returns only the base prompt when no instructions or extra", () => {
    const result = assembleSystemPrompt(BASE, null, undefined);

    expect(result).toBe(BASE);
    expect(result).not.toContain("<project-instructions>");
  });

  // Spec: repl-chat-loop > System prompt > "System prompt with only AGENTS.md"
  it("assembles base + project instructions when no extra prompt", () => {
    const result = assembleSystemPrompt(BASE, "Project rules here.", undefined);

    expect(result).toContain(BASE);
    expect(result).toContain("<project-instructions>");
    expect(result).toContain("Project rules here.");
    expect(result).toContain("</project-instructions>");
    expect(result).not.toContain("undefined");
  });

  // Base + extra prompt only (no AGENTS.md)
  it("assembles base + extra prompt when no project instructions", () => {
    const result = assembleSystemPrompt(BASE, null, "Be concise.");

    expect(result).toContain(BASE);
    expect(result).toContain("Be concise.");
    expect(result).not.toContain("<project-instructions>");
  });
});
