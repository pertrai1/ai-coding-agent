import { describe, expect, it, vi } from "vitest";

import { createMcpManager } from "../../mcp/manager.js";
import { createToolRegistry } from "../../tools/index.js";

describe("createMcpManager", () => {
  it("registers namespaced MCP tools and executes through the client", async () => {
    const registry = createToolRegistry();
    const callTool = vi.fn().mockResolvedValue({ content: "tool output" });

    const manager = await createMcpManager({
      servers: { filesystem: { command: "npx" } },
      toolRegistry: registry,
      createClient: () => ({
        connect: async () => [
          {
            name: "read_file",
            description: "Read a file",
            inputSchema: { type: "object", properties: { path: { type: "string" } } },
          },
        ],
        callTool,
        close: vi.fn().mockResolvedValue(undefined),
      }),
    });

    const tool = registry.get("mcp__filesystem__read_file");
    const result = await tool?.execute({ path: "package.json" });

    expect(manager.warnings).toEqual([]);
    expect(tool?.permission).toBe("prompt");
    expect(callTool).toHaveBeenCalledWith("read_file", { path: "package.json" });
    expect(result).toEqual({ content: "tool output" });
  });

  it("skips disabled servers", async () => {
    const registry = createToolRegistry();
    const createClient = vi.fn();

    await createMcpManager({
      servers: { filesystem: { command: "npx", enabled: false } },
      toolRegistry: registry,
      createClient,
    });

    expect(createClient).not.toHaveBeenCalled();
    expect(registry.get("mcp__filesystem__read_file")).toBeUndefined();
  });

  it("warns and continues when one server fails", async () => {
    const registry = createToolRegistry();

    const manager = await createMcpManager({
      servers: {
        broken: { command: "broken" },
        healthy: { command: "healthy" },
      },
      toolRegistry: registry,
      createClient: (serverName) => {
        if (serverName === "broken") {
          return {
            connect: async () => { throw new Error("boom"); },
            callTool: vi.fn(),
            close: vi.fn().mockResolvedValue(undefined),
          };
        }

        return {
          connect: async () => [{ name: "glob", inputSchema: { type: "object", properties: {} } }],
          callTool: vi.fn().mockResolvedValue({ content: "ok" }),
          close: vi.fn().mockResolvedValue(undefined),
        };
      },
    });

    expect(manager.warnings).toEqual([
      expect.stringContaining('failed to initialize MCP server "broken"'),
    ]);
    expect(registry.get("mcp__healthy__glob")).toBeDefined();
  });

  it("closes connected clients", async () => {
    const registry = createToolRegistry();
    const close = vi.fn().mockResolvedValue(undefined);

    const manager = await createMcpManager({
      servers: { filesystem: { command: "npx" } },
      toolRegistry: registry,
      createClient: () => ({
        connect: async () => [{ name: "glob", inputSchema: { type: "object", properties: {} } }],
        callTool: vi.fn().mockResolvedValue({ content: "ok" }),
        close,
      }),
    });

    await manager.close();

    expect(close).toHaveBeenCalled();
  });
});
