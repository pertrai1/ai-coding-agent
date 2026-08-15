import { beforeEach, describe, expect, it, vi } from "vitest";

import { McpClient } from "../../mcp/client.js";

const connect = vi.fn<() => Promise<void>>();
const listTools = vi.fn<() => Promise<{ tools: unknown[] }>>();
const callTool = vi.fn<() => Promise<unknown>>();
const close = vi.fn<() => Promise<void>>();
const transportConstructor = vi.fn();

vi.mock("@modelcontextprotocol/sdk/client/index.js", () => ({
  Client: class {
    connect = connect;
    listTools = listTools;
    callTool = callTool;
  },
}));

vi.mock("@modelcontextprotocol/sdk/client/stdio.js", () => ({
  StdioClientTransport: class {
    constructor(options: unknown) {
      transportConstructor(options);
    }

    close = close;
  },
}));

describe("McpClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("connects and maps discovered tools", async () => {
    listTools.mockResolvedValue({
      tools: [
        {
          name: "read_file",
          description: "Read a file",
          inputSchema: { type: "object", properties: { path: { type: "string" } } },
        },
      ],
    });

    const client = new McpClient("filesystem", {
      command: "npx",
      args: ["server"],
      env: { TEST: "1" },
    });

    const tools = await client.connect();

    expect(transportConstructor).toHaveBeenCalledWith({
      command: "npx",
      args: ["server"],
      env: { TEST: "1" },
    });
    expect(connect).toHaveBeenCalled();
    expect(tools).toEqual([
      {
        name: "read_file",
        description: "Read a file",
        inputSchema: { type: "object", properties: { path: { type: "string" } } },
      },
    ]);
  });

  it("joins text content from tool results", async () => {
    callTool.mockResolvedValue({
      content: [
        { type: "text", text: "line one" },
        { type: "text", text: "line two" },
      ],
    });

    const client = new McpClient("filesystem", { command: "npx" });
    const result = await client.callTool("read_file", { path: "package.json" });

    expect(callTool).toHaveBeenCalledWith({
      name: "read_file",
      arguments: { path: "package.json" },
    });
    expect(result).toEqual({ content: "line one\nline two", isError: undefined });
  });

  it("serializes structured content when text content is absent", async () => {
    callTool.mockResolvedValue({
      structuredContent: { files: ["a.ts", "b.ts"] },
    });

    const client = new McpClient("filesystem", { command: "npx" });
    const result = await client.callTool("glob", { pattern: "*.ts" });

    expect(result).toEqual({
      content: JSON.stringify({ files: ["a.ts", "b.ts"] }, null, 2),
      isError: undefined,
    });
  });

  it("closes the underlying transport", async () => {
    const client = new McpClient("filesystem", { command: "npx" });

    await client.close();

    expect(close).toHaveBeenCalled();
  });
});
