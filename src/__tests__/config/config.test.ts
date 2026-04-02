import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { homedir } from "node:os";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { loadConfig } from "../../config/index.js";

describe("loadConfig", () => {
  let tempDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "config-test-"));
    originalCwd = process.cwd();
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await rm(tempDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  // Spec: config-hierarchy > Three-tier config file discovery > "No config files exist"
  it("returns empty config when no config files exist", () => {
    process.chdir(tempDir);

    const result = loadConfig({ cwd: tempDir, globalConfigDir: join(tempDir, ".global-config") });

    expect(result).toEqual({});
  });

  // Spec: config-hierarchy > Three-tier config file discovery > "All three config files exist"
  it("loads and merges all three config files when present", async () => {
    const globalDir = join(tempDir, "global", "ai-agent");
    const projectDir = join(tempDir, "project", ".ai-agent");

    await mkdir(globalDir, { recursive: true });
    await mkdir(projectDir, { recursive: true });

    await writeFile(
      join(globalDir, "config.json"),
      JSON.stringify({ model: "claude-sonnet-4-20250514", permissions: { bash: "deny" } }),
    );
    await writeFile(
      join(projectDir, "config.json"),
      JSON.stringify({ permissions: { bash: "prompt" } }),
    );
    await writeFile(
      join(projectDir, "config.local.json"),
      JSON.stringify({ model: "claude-haiku-4-5-20250514" }),
    );

    const result = loadConfig({
      cwd: join(tempDir, "project"),
      globalConfigDir: globalDir,
    });

    expect(result.model).toBe("claude-haiku-4-5-20250514");
    expect(result.permissions?.bash).toBe("prompt");
  });

  // Spec: config-hierarchy > Three-tier config file discovery > "Only project config exists"
  it("loads only project config when global and local are absent", async () => {
    const projectDir = join(tempDir, "project", ".ai-agent");
    await mkdir(projectDir, { recursive: true });

    await writeFile(
      join(projectDir, "config.json"),
      JSON.stringify({ model: "claude-haiku-4-5-20250514" }),
    );

    const result = loadConfig({
      cwd: join(tempDir, "project"),
      globalConfigDir: join(tempDir, "nonexistent"),
    });

    expect(result.model).toBe("claude-haiku-4-5-20250514");
  });

  // Spec: config-hierarchy > Invalid config handling > "Invalid permission value"
  it("warns and skips invalid permission values", async () => {
    const projectDir = join(tempDir, "project", ".ai-agent");
    await mkdir(projectDir, { recursive: true });

    await writeFile(
      join(projectDir, "config.json"),
      JSON.stringify({ permissions: { bash: "always", write_file: "prompt" } }),
    );

    const result = loadConfig({
      cwd: join(tempDir, "project"),
      globalConfigDir: join(tempDir, "nonexistent"),
    });

    expect(console.warn).toHaveBeenCalledWith(
      "Warning: invalid permission value for tool",
      expect.objectContaining({ tool: "bash", permission: "always" }),
    );
    expect(result.permissions?.bash).toBeUndefined();
    expect(result.permissions?.write_file).toBe("prompt");
  });

  // Spec: config-hierarchy > Invalid config handling > "Malformed JSON in one config file"
  it("skips malformed config and merges remaining valid configs", async () => {
    const globalDir = join(tempDir, "global", "ai-agent");
    const projectDir = join(tempDir, "project", ".ai-agent");

    await mkdir(globalDir, { recursive: true });
    await mkdir(projectDir, { recursive: true });

    await writeFile(
      join(globalDir, "config.json"),
      JSON.stringify({ model: "claude-sonnet-4-20250514" }),
    );
    await writeFile(
      join(projectDir, "config.json"),
      "{ broken json !!!",
    );
    await writeFile(
      join(projectDir, "config.local.json"),
      JSON.stringify({ systemPromptExtra: "local extra" }),
    );

    const result = loadConfig({
      cwd: join(tempDir, "project"),
      globalConfigDir: globalDir,
    });

    expect(console.warn).toHaveBeenCalled();
    expect(result.model).toBe("claude-sonnet-4-20250514");
    expect(result.systemPromptExtra).toBe("local extra");
  });
});
