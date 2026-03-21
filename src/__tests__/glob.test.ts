import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { globTool } from "../tools/glob.js";

describe("glob tool", () => {
  let tempDir: string | undefined;

  afterEach(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
      tempDir = undefined;
    }
  });

  it("matches files with a glob pattern", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "tools-test-"));
    await writeFile(join(tempDir, "one.ts"), "", "utf-8");
    await writeFile(join(tempDir, "two.ts"), "", "utf-8");
    await writeFile(join(tempDir, "three.js"), "", "utf-8");

    const result = await globTool.execute({ pattern: "*.ts", path: tempDir });

    expect(result.isError).toBeUndefined();
    expect(result.content).toContain("one.ts");
    expect(result.content).toContain("two.ts");
    expect(result.content).not.toContain("three.js");
  });

  it("returns a message when no files match", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "tools-test-"));

    const result = await globTool.execute({ pattern: "*.xyz", path: tempDir });

    expect(result.isError).toBeUndefined();
    expect(result.content).toContain("No files matched");
  });

  it("searches from a custom base path", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "tools-test-"));
    const subDir = join(tempDir, "sub");
    await mkdir(subDir);
    await writeFile(join(subDir, "nested.ts"), "", "utf-8");

    const result = await globTool.execute({ pattern: "*.ts", path: subDir });

    expect(result.isError).toBeUndefined();
    expect(result.content).toContain("nested.ts");
  });

  it("matches files in nested directories", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "tools-test-"));
    await mkdir(join(tempDir, "a", "b"), { recursive: true });
    await writeFile(join(tempDir, "a", "b", "deep.ts"), "", "utf-8");

    const result = await globTool.execute({ pattern: "**/*.ts", path: tempDir });

    expect(result.isError).toBeUndefined();
    expect(result.content).toContain("deep.ts");
  });

  it("returns an error when pattern is missing", async () => {
    const result = await globTool.execute({});

    expect(result.isError).toBe(true);
    expect(result.content).toContain("pattern");
  });

  it("returns an error when pattern is empty", async () => {
    const result = await globTool.execute({ pattern: "" });

    expect(result.isError).toBe(true);
    expect(result.content).toContain("pattern");
  });

  it("returns an error when path is not a string", async () => {
    const result = await globTool.execute({ pattern: "*.ts", path: 123 });

    expect(result.isError).toBe(true);
    expect(result.content).toContain("path");
  });
});
