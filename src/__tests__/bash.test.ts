import { describe, expect, it } from "vitest";

import { bashTool } from "../tools/bash.js";

describe("bash tool", () => {
  it("executes a successful command and returns stdout, stderr, and exit code", async () => {
    const result = await bashTool.execute({ command: "echo hello" });

    expect(result.isError).toBeUndefined();
    expect(result.content).toContain("hello");
    expect(result.content).toContain("exit code:\n0");
  });

  it("returns structured output with labeled sections", async () => {
    const result = await bashTool.execute({ command: "echo hello" });

    expect(result.content).toMatch(/^stdout:\n/);
    expect(result.content).toContain("stderr:\n");
    expect(result.content).toContain("exit code:\n");
  });

  it("returns isError true for non-zero exit code", async () => {
    const result = await bashTool.execute({ command: "exit 1" });

    expect(result.isError).toBe(true);
    expect(result.content).toContain("exit code:\n1");
  });

  it("captures stderr output", async () => {
    const result = await bashTool.execute({ command: "echo err >&2" });

    expect(result.content).toContain("stderr:\nerr\n");
  });

  it("returns error for missing command", async () => {
    const result = await bashTool.execute({});

    expect(result.isError).toBe(true);
    expect(result.content).toContain("command is required");
  });

  it("returns error for empty command", async () => {
    const result = await bashTool.execute({ command: "" });

    expect(result.isError).toBe(true);
    expect(result.content).toContain("command is required");
  });

  it("includes empty stderr section when no stderr output", async () => {
    const result = await bashTool.execute({ command: "echo hello" });

    expect(result.content).toContain("stderr:\n");
    expect(result.content).toContain("exit code:\n0");
  });

  it("has permission set to prompt", () => {
    expect(bashTool.permission).toBe("prompt");
  });
});
