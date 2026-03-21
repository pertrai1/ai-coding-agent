import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { writeFileTool } from "../tools/write-file.js";

describe("write_file tool", () => {
  let tempDir: string | undefined;

  afterEach(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
      tempDir = undefined;
    }
  });

  it("creates a new file with the given content", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "tools-test-"));
    const filePath = join(tempDir, "hello.txt");

    const result = await writeFileTool.execute({ filePath, content: "hello world" });

    expect(result.isError).toBeUndefined();
    expect(result.content).toContain(filePath);

    const written = await readFile(filePath, "utf-8");
    expect(written).toBe("hello world");
  });

  it("overwrites an existing file", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "tools-test-"));
    const filePath = join(tempDir, "existing.txt");
    await writeFile(filePath, "old content", "utf-8");

    const result = await writeFileTool.execute({ filePath, content: "new content" });

    expect(result.isError).toBeUndefined();

    const written = await readFile(filePath, "utf-8");
    expect(written).toBe("new content");
  });

  it("writes empty content without error", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "tools-test-"));
    const filePath = join(tempDir, "empty.txt");

    const result = await writeFileTool.execute({ filePath, content: "" });

    expect(result.isError).toBeUndefined();

    const written = await readFile(filePath, "utf-8");
    expect(written).toBe("");
  });

  it("auto-creates nested parent directories", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "tools-test-"));
    const filePath = join(tempDir, "a", "b", "c", "deep.txt");

    const result = await writeFileTool.execute({ filePath, content: "deep" });

    expect(result.isError).toBeUndefined();

    const written = await readFile(filePath, "utf-8");
    expect(written).toBe("deep");
  });

  it("returns an error when filePath is missing", async () => {
    const result = await writeFileTool.execute({ content: "hello" });

    expect(result.isError).toBe(true);
    expect(result.content).toContain("filePath");
  });

  it("returns an error when filePath is empty", async () => {
    const result = await writeFileTool.execute({ filePath: "", content: "hello" });

    expect(result.isError).toBe(true);
    expect(result.content).toContain("filePath");
  });

  it("returns an error when content is missing", async () => {
    const result = await writeFileTool.execute({ filePath: "/tmp/test.txt" });

    expect(result.isError).toBe(true);
    expect(result.content).toContain("content");
  });

  it("returns an error when filePath is a directory", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "tools-test-"));

    const result = await writeFileTool.execute({ filePath: tempDir, content: "hello" });

    expect(result.isError).toBe(true);
    expect(result.content.toLowerCase()).toContain("directory");
  });
});
