import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { editFileTool } from "../tools/editFileTool.js";

describe("edit_file tool", () => {
  let tempDir: string | undefined;

  afterEach(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
      tempDir = undefined;
    }
  });

  it("replaces a unique match and writes the result", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "tools-test-"));
    const filePath = join(tempDir, "sample.ts");
    await writeFile(filePath, "const x = 1;\nconst y = 2;\n", "utf-8");

    const result = await editFileTool.execute({
      filePath,
      findText: "const x = 1;",
      replaceText: "const x = 42;",
    });

    expect(result.isError).toBeUndefined();
    expect(result.content).toContain("Successfully edited");

    const updated = await readFile(filePath, "utf-8");
    expect(updated).toBe("const x = 42;\nconst y = 2;\n");
  });

  it("returns an error when text is not found", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "tools-test-"));
    const filePath = join(tempDir, "sample.ts");
    await writeFile(filePath, "const x = 1;\n", "utf-8");

    const result = await editFileTool.execute({
      filePath,
      findText: "const z = 99;",
      replaceText: "replaced",
    });

    expect(result.isError).toBe(true);
    expect(result.content).toContain("not found");
  });

  it("returns an error when multiple matches exist", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "tools-test-"));
    const filePath = join(tempDir, "sample.ts");
    await writeFile(filePath, "foo\nfoo\nbar\n", "utf-8");

    const result = await editFileTool.execute({
      filePath,
      findText: "foo",
      replaceText: "baz",
    });

    expect(result.isError).toBe(true);
    expect(result.content).toContain("2 matches");
  });

  it("supports empty replaceText for deletion", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "tools-test-"));
    const filePath = join(tempDir, "sample.ts");
    await writeFile(filePath, "hello world", "utf-8");

    const result = await editFileTool.execute({
      filePath,
      findText: " world",
      replaceText: "",
    });

    expect(result.isError).toBeUndefined();

    const updated = await readFile(filePath, "utf-8");
    expect(updated).toBe("hello");
  });

  it("preserves surrounding content", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "tools-test-"));
    const filePath = join(tempDir, "sample.ts");
    await writeFile(filePath, "before\ntarget\nafter\n", "utf-8");

    await editFileTool.execute({
      filePath,
      findText: "target",
      replaceText: "replaced",
    });

    const updated = await readFile(filePath, "utf-8");
    expect(updated).toBe("before\nreplaced\nafter\n");
  });

  it("returns an error when filePath is missing", async () => {
    const result = await editFileTool.execute({
      findText: "a",
      replaceText: "b",
    });

    expect(result.isError).toBe(true);
    expect(result.content).toContain("filePath");
  });

  it("returns an error when findText is missing", async () => {
    const result = await editFileTool.execute({
      filePath: "/tmp/test.txt",
      replaceText: "b",
    });

    expect(result.isError).toBe(true);
    expect(result.content).toContain("findText");
  });

  it("returns an error when findText is empty", async () => {
    const result = await editFileTool.execute({
      filePath: "/tmp/test.txt",
      findText: "",
      replaceText: "b",
    });

    expect(result.isError).toBe(true);
    expect(result.content).toContain("findText");
  });

  it("returns an error when replaceText is missing", async () => {
    const result = await editFileTool.execute({
      filePath: "/tmp/test.txt",
      findText: "a",
    });

    expect(result.isError).toBe(true);
    expect(result.content).toContain("replaceText");
  });

  it("returns an error for non-existent file", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "tools-test-"));
    const filePath = join(tempDir, "does-not-exist.txt");

    const result = await editFileTool.execute({
      filePath,
      findText: "a",
      replaceText: "b",
    });

    expect(result.isError).toBe(true);
    expect(result.content).toContain("not found");
  });
});
