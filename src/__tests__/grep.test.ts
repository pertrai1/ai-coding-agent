import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { grepTool } from "../tools/grep.js";

describe("grep tool", () => {
  let tempDir: string | undefined;

  afterEach(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
      tempDir = undefined;
    }
  });

  it("finds matches in a single file", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "tools-test-"));
    const filePath = join(tempDir, "sample.ts");
    await writeFile(filePath, "const x = 1;\nconst y = 2;\nconst z = 3;\n", "utf-8");

    const result = await grepTool.execute({ pattern: "const y", path: filePath });

    expect(result.isError).toBeUndefined();
    expect(result.content).toContain("const y = 2;");
    expect(result.content).toContain(":2:");
  });

  it("finds matches across multiple files in a directory", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "tools-test-"));
    await writeFile(join(tempDir, "a.ts"), "hello world\n", "utf-8");
    await writeFile(join(tempDir, "b.ts"), "hello there\n", "utf-8");
    await writeFile(join(tempDir, "c.ts"), "goodbye\n", "utf-8");

    const result = await grepTool.execute({ pattern: "hello", path: tempDir });

    expect(result.isError).toBeUndefined();
    expect(result.content).toContain("a.ts");
    expect(result.content).toContain("b.ts");
    expect(result.content).not.toContain("c.ts");
  });

  it("returns a message when no matches are found", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "tools-test-"));
    await writeFile(join(tempDir, "sample.ts"), "nothing here\n", "utf-8");

    const result = await grepTool.execute({ pattern: "zzzzz", path: tempDir });

    expect(result.isError).toBeUndefined();
    expect(result.content).toContain("No matches");
  });

  it("uses 1-based line numbers", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "tools-test-"));
    const filePath = join(tempDir, "lines.ts");
    await writeFile(filePath, "aaa\nbbb\nccc\n", "utf-8");

    const result = await grepTool.execute({ pattern: "bbb", path: filePath });

    expect(result.content).toContain(":2:");
    expect(result.content).not.toContain(":1:");
    expect(result.content).not.toContain(":0:");
  });

  it("filters files with the include option", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "tools-test-"));
    await writeFile(join(tempDir, "code.ts"), "target\n", "utf-8");
    await writeFile(join(tempDir, "readme.md"), "target\n", "utf-8");

    const result = await grepTool.execute({
      pattern: "target",
      path: tempDir,
      include: "*.ts",
    });

    expect(result.isError).toBeUndefined();
    expect(result.content).toContain("code.ts");
    expect(result.content).not.toContain("readme.md");
  });

  it("supports regex patterns", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "tools-test-"));
    const filePath = join(tempDir, "sample.ts");
    await writeFile(filePath, "foo123\nbar456\nfoo789\n", "utf-8");

    const result = await grepTool.execute({ pattern: "foo\\d+", path: filePath });

    expect(result.isError).toBeUndefined();
    expect(result.content).toContain("foo123");
    expect(result.content).toContain("foo789");
    expect(result.content).not.toContain("bar456");
  });

  it("falls back to literal match for invalid regex", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "tools-test-"));
    const filePath = join(tempDir, "sample.ts");
    await writeFile(filePath, "has [bracket\nno match\n", "utf-8");

    const result = await grepTool.execute({ pattern: "[bracket", path: filePath });

    expect(result.isError).toBeUndefined();
    expect(result.content).toContain("[bracket");
  });

  it("returns an error for non-existent path", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "tools-test-"));
    const fakePath = join(tempDir, "does-not-exist");

    const result = await grepTool.execute({ pattern: "hello", path: fakePath });

    expect(result.isError).toBe(true);
    expect(result.content).toContain("not found");
  });

  it("returns an error when pattern is missing", async () => {
    const result = await grepTool.execute({});

    expect(result.isError).toBe(true);
    expect(result.content).toContain("pattern");
  });

  it("searches nested directories", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "tools-test-"));
    await mkdir(join(tempDir, "sub"), { recursive: true });
    await writeFile(join(tempDir, "sub", "deep.ts"), "needle\n", "utf-8");

    const result = await grepTool.execute({ pattern: "needle", path: tempDir });

    expect(result.isError).toBeUndefined();
    expect(result.content).toContain("deep.ts");
    expect(result.content).toContain("needle");
  });
});
