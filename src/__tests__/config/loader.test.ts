import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { loadConfigFile } from "../../config/loadConfigFile.js";

describe("loadConfigFile", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "config-loader-test-"));
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  // Spec: config-hierarchy > Config file format > "Valid config with all keys"
  it("parses a valid config file with all keys", async () => {
    const configPath = join(tempDir, "config.json");
    await writeFile(
      configPath,
      JSON.stringify({
        model: "claude-haiku-4-5-20250514",
        systemPromptExtra: "Be brief.",
        permissions: { bash: "deny" },
      }),
    );

    const result = loadConfigFile(configPath);

    expect(result).toEqual({
      model: "claude-haiku-4-5-20250514",
      systemPromptExtra: "Be brief.",
      permissions: { bash: "deny" },
    });
  });

  // Spec: config-hierarchy > Config file format > "Config with only model key"
  it("parses a config file with only the model key", async () => {
    const configPath = join(tempDir, "config.json");
    await writeFile(
      configPath,
      JSON.stringify({ model: "claude-haiku-4-5-20250514" }),
    );

    const result = loadConfigFile(configPath);

    expect(result).toEqual({ model: "claude-haiku-4-5-20250514" });
    expect(result?.systemPromptExtra).toBeUndefined();
    expect(result?.permissions).toBeUndefined();
  });

  // Spec: config-hierarchy > Config file format > "Config with unknown keys"
  it("parses known keys and silently ignores unknown keys", async () => {
    const configPath = join(tempDir, "config.json");
    await writeFile(
      configPath,
      JSON.stringify({ model: "claude-haiku-4-5-20250514", unknownKey: true }),
    );

    const result = loadConfigFile(configPath);

    expect(result?.model).toBe("claude-haiku-4-5-20250514");
    expect(result).not.toHaveProperty("unknownKey");
  });

  // Spec: config-hierarchy > Three-tier config file discovery > "No config files exist"
  it("returns null when the config file does not exist", () => {
    const result = loadConfigFile(join(tempDir, "nonexistent.json"));

    expect(result).toBeNull();
  });

  // Spec: config-hierarchy > Invalid config handling > "Malformed JSON in one config file"
  it("returns null and logs a warning for malformed JSON", async () => {
    const configPath = join(tempDir, "config.json");
    await writeFile(configPath, "{ not valid json }}}");

    const result = loadConfigFile(configPath);

    expect(result).toBeNull();
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining(configPath),
    );
  });

  // Spec: config-hierarchy > Config file format > permissions-only config
  it("parses a config file with only permissions", async () => {
    const configPath = join(tempDir, "config.json");
    await writeFile(
      configPath,
      JSON.stringify({ permissions: { bash: "allow", write_file: "deny" } }),
    );

    const result = loadConfigFile(configPath);

    expect(result).toEqual({
      permissions: { bash: "allow", write_file: "deny" },
    });
    expect(result?.model).toBeUndefined();
  });
});
