import { describe, expect, it } from "vitest";

import {
  createToolRegistry,
  enablePlanMode,
  disablePlanMode,
  isMutatingTool,
} from "../tools/index.js";

describe("isMutatingTool", () => {
  it("identifies mutating tools", () => {
    expect(isMutatingTool("edit_file")).toBe(true);
    expect(isMutatingTool("write_file")).toBe(true);
    expect(isMutatingTool("bash")).toBe(true);
    expect(isMutatingTool("subagent")).toBe(true);
  });

  it("identifies read-only tools", () => {
    expect(isMutatingTool("read_file")).toBe(false);
    expect(isMutatingTool("glob")).toBe(false);
    expect(isMutatingTool("grep")).toBe(false);
  });
});

describe("enablePlanMode", () => {
  it("sets all mutating tools to deny", () => {
    const registry = createToolRegistry();
    enablePlanMode(registry);

    expect(registry.get("edit_file")?.permission).toBe("deny");
    expect(registry.get("write_file")?.permission).toBe("deny");
    expect(registry.get("bash")?.permission).toBe("deny");
  });

  it("leaves read-only tools unchanged", () => {
    const registry = createToolRegistry();
    enablePlanMode(registry);

    expect(registry.get("read_file")?.permission).toBe("allow");
    expect(registry.get("glob")?.permission).toBe("allow");
    expect(registry.get("grep")?.permission).toBe("allow");
  });
});

describe("disablePlanMode", () => {
  it("restores mutating tools to default prompt permission", () => {
    const registry = createToolRegistry();
    enablePlanMode(registry);
    disablePlanMode(registry);

    expect(registry.get("edit_file")?.permission).toBe("prompt");
    expect(registry.get("write_file")?.permission).toBe("prompt");
    expect(registry.get("bash")?.permission).toBe("prompt");
  });

  it("respects permission overrides when restoring", () => {
    const registry = createToolRegistry();
    enablePlanMode(registry);
    disablePlanMode(registry, { bash: "allow" });

    expect(registry.get("bash")?.permission).toBe("allow");
    expect(registry.get("edit_file")?.permission).toBe("prompt");
  });

  it("leaves read-only tools unchanged", () => {
    const registry = createToolRegistry();
    enablePlanMode(registry);
    disablePlanMode(registry);

    expect(registry.get("read_file")?.permission).toBe("allow");
    expect(registry.get("glob")?.permission).toBe("allow");
    expect(registry.get("grep")?.permission).toBe("allow");
  });
});

describe("plan mode toggle cycle", () => {
  it("can toggle plan mode on and off repeatedly", () => {
    const registry = createToolRegistry();

    enablePlanMode(registry);
    expect(registry.get("edit_file")?.permission).toBe("deny");

    disablePlanMode(registry);
    expect(registry.get("edit_file")?.permission).toBe("prompt");

    enablePlanMode(registry);
    expect(registry.get("edit_file")?.permission).toBe("deny");

    disablePlanMode(registry);
    expect(registry.get("edit_file")?.permission).toBe("prompt");
  });
});
