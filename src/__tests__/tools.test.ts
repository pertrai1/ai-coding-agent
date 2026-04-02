import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { createToolRegistry } from "../tools/index.js";
import { readFileTool } from "../tools/readFileTool.js";

describe("tool registry", () => {
  it("registers all six built-in tools on creation", () => {
    const registry = createToolRegistry();
    const definitions = registry.getDefinitions();
    const names = definitions.map((d) => d.name);

    expect(names).toContain("read_file");
    expect(names).toContain("edit_file");
    expect(names).toContain("write_file");
    expect(names).toContain("glob");
    expect(names).toContain("grep");
    expect(names).toContain("bash");
    expect(definitions).toHaveLength(6);
  });

  it("assigns allow permission to read-only tools", () => {
    const registry = createToolRegistry();

    expect(registry.get("read_file")?.permission).toBe("allow");
    expect(registry.get("glob")?.permission).toBe("allow");
    expect(registry.get("grep")?.permission).toBe("allow");
  });

  it("assigns prompt permission to mutating tools", () => {
    const registry = createToolRegistry();

    expect(registry.get("write_file")?.permission).toBe("prompt");
    expect(registry.get("edit_file")?.permission).toBe("prompt");
    expect(registry.get("bash")?.permission).toBe("prompt");
  });

  it("registers and retrieves a tool by name", () => {
    const registry = createToolRegistry();
    const testTool = {
      definition: {
        name: "test_tool",
        description: "A test tool",
        input_schema: {
          type: "object" as const,
          properties: {},
        },
      },
      execute: async () => ({ content: "ok" }),
    };

    registry.register(testTool);

    expect(registry.get("test_tool")).toBe(testTool);
  });

  it("returns undefined for unregistered tools", () => {
    const registry = createToolRegistry();

    expect(registry.get("missing_tool")).toBeUndefined();
  });

  it("returns all registered tool definitions in Anthropic format", () => {
    const registry = createToolRegistry();
    const testTool = {
      definition: {
        name: "test_tool",
        description: "A test tool",
        input_schema: {
          type: "object" as const,
          properties: {
            input: {
              type: "string",
            },
          },
          required: ["input"],
        },
      },
      execute: async () => ({ content: "ok" }),
    };

    registry.register(testTool);

    expect(registry.getDefinitions()).toContainEqual(readFileTool.definition);
    expect(registry.getDefinitions()).toContainEqual(testTool.definition);
  });
});

describe("read_file tool", () => {
  let tempDir: string | undefined;

  afterEach(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
      tempDir = undefined;
    }
  });

  it("reads an existing file and returns its content", async () => {
    const expected = await readFile("package.json", "utf-8");

    const result = await readFileTool.execute({ filePath: "package.json" });

    expect(result).toEqual({ content: expected });
  });

  it("preserves line breaks and whitespace for multi-line files", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "tools-test-"));
    const filePath = join(tempDir, "multiline.txt");
    const text = "first line\n  second line\nthird line\n";

    await writeFile(filePath, text, "utf-8");

    const result = await readFileTool.execute({ filePath });

    expect(result).toEqual({ content: text });
  });

  it("returns an error result for missing files", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "tools-test-"));
    const filePath = join(tempDir, "does-not-exist.txt");

    const result = await readFileTool.execute({ filePath });

    expect(result.isError).toBe(true);
    expect(result.content).toContain(filePath);
  });

  it("returns empty content for empty files", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "tools-test-"));
    const filePath = join(tempDir, "empty.txt");

    await writeFile(filePath, "", "utf-8");

    const result = await readFileTool.execute({ filePath });

    expect(result).toEqual({ content: "" });
  });

  it("returns an error result when filePath is a directory", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "tools-test-"));

    const result = await readFileTool.execute({ filePath: tempDir });

    expect(result.isError).toBe(true);
    expect(result.content.toLowerCase()).toContain("directory");
  });
});
