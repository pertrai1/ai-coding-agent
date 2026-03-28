import { describe, expect, it } from "vitest";

import { createToolRegistry } from "../../tools/index.js";

describe("tool registry permission overrides", () => {
  // Spec: tool-permissions > "Read-only tools default to allow" (baseline, no overrides)
  it("preserves default allow permissions when no overrides given", () => {
    const registry = createToolRegistry();

    expect(registry.get("read_file")?.permission).toBe("allow");
    expect(registry.get("glob")?.permission).toBe("allow");
    expect(registry.get("grep")?.permission).toBe("allow");
  });

  // Spec: tool-permissions > "Mutating tools default to prompt" (baseline, no overrides)
  it("preserves default prompt permissions when no overrides given", () => {
    const registry = createToolRegistry();

    expect(registry.get("write_file")?.permission).toBe("prompt");
    expect(registry.get("edit_file")?.permission).toBe("prompt");
    expect(registry.get("bash")?.permission).toBe("prompt");
  });

  // Spec: tool-permissions > "Config overrides default permission"
  it("overrides bash to allow when config specifies it", () => {
    const registry = createToolRegistry({ bash: "allow" });

    expect(registry.get("bash")?.permission).toBe("allow");
    // Other tools retain defaults
    expect(registry.get("read_file")?.permission).toBe("allow");
    expect(registry.get("write_file")?.permission).toBe("prompt");
    expect(registry.get("edit_file")?.permission).toBe("prompt");
    expect(registry.get("glob")?.permission).toBe("allow");
    expect(registry.get("grep")?.permission).toBe("allow");
  });

  // Spec: tool-permissions > "Config sets tool to deny"
  it("sets write_file to deny when config specifies it", () => {
    const registry = createToolRegistry({ write_file: "deny" });

    expect(registry.get("write_file")?.permission).toBe("deny");
  });

  // Spec: tool-permissions > "Config override for unknown tool is ignored"
  it("silently ignores overrides for unregistered tool names", () => {
    const registry = createToolRegistry({ unknown_tool: "allow" });

    // All registered tools retain their defaults
    expect(registry.get("read_file")?.permission).toBe("allow");
    expect(registry.get("bash")?.permission).toBe("prompt");
    expect(registry.get("unknown_tool")).toBeUndefined();
  });

  // Multiple overrides at once
  it("applies multiple overrides simultaneously", () => {
    const registry = createToolRegistry({
      bash: "allow",
      write_file: "deny",
      read_file: "prompt",
    });

    expect(registry.get("bash")?.permission).toBe("allow");
    expect(registry.get("write_file")?.permission).toBe("deny");
    expect(registry.get("read_file")?.permission).toBe("prompt");
    // Unmentioned tools retain defaults
    expect(registry.get("edit_file")?.permission).toBe("prompt");
    expect(registry.get("glob")?.permission).toBe("allow");
  });
});
