import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

import type { ToolDefinition } from "../api/anthropic.js";
import type { McpServerConfig } from "../config/types.js";

export type McpTool = {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown> & {
    type: "object";
    properties?: Record<string, object>;
    required?: string[];
  };
};

type McpCallResult = {
  content?: unknown[];
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
};

function formatContentItem(item: unknown): string {
  if (!item || typeof item !== "object") {
    return JSON.stringify(item);
  }

  const block = item as Record<string, unknown>;
  if (block.type === "text" && typeof block.text === "string") {
    return block.text;
  }

  return JSON.stringify(block);
}

export class McpClient {
  private readonly client = new Client({
    name: "ai-coding-agent",
    version: "0.1.0",
  });

  private readonly transport: StdioClientTransport;

  constructor(
    public readonly serverName: string,
    config: McpServerConfig,
  ) {
    this.transport = new StdioClientTransport({
      command: config.command,
      args: config.args,
      env: config.env,
    });
  }

  async connect(): Promise<McpTool[]> {
    await this.client.connect(this.transport);
    const result = await this.client.listTools();
    return result.tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
    }));
  }

  async callTool(name: string, input: Record<string, unknown>): Promise<{ content: string; isError?: boolean }> {
    const result = await this.client.callTool({
      name,
      arguments: input,
    }) as McpCallResult;

    const content = result.content?.map(formatContentItem).filter(Boolean).join("\n")
      ?? "";

    if (content) {
      return { content, isError: result.isError };
    }

    if (result.structuredContent) {
      return {
        content: JSON.stringify(result.structuredContent, null, 2),
        isError: result.isError,
      };
    }

    return {
      content: result.isError ? "MCP tool returned an error with no content." : "MCP tool completed with no content.",
      isError: result.isError,
    };
  }

  async close(): Promise<void> {
    await this.transport.close();
  }
}
