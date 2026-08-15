import type { ToolDefinition } from "../api/anthropic.js";
import type { McpServerConfig } from "../config/types.js";
import type { ToolRegistration, ToolRegistry } from "../tools/index.js";
import { McpClient } from "./client.js";
import type { McpTool } from "./client.js";

type CreateMcpManagerOptions = {
  servers?: Record<string, McpServerConfig>;
  toolRegistry: ToolRegistry;
  createClient?: (serverName: string, config: McpServerConfig) => McpClientLike;
};

type McpClientLike = {
  connect: () => Promise<McpTool[]>;
  callTool: (name: string, input: Record<string, unknown>) => Promise<{ content: string; isError?: boolean }>;
  close: () => Promise<void>;
};

function toNamespacedToolName(serverName: string, toolName: string): string {
  return `mcp__${serverName}__${toolName}`;
}

function createToolRegistration(options: {
  client: McpClientLike;
  serverName: string;
  tool: McpTool;
}): ToolRegistration {
  const { client, serverName, tool } = options;

  return {
    definition: {
      name: toNamespacedToolName(serverName, tool.name),
      description: tool.description ?? `MCP tool ${tool.name} from server ${serverName}.`,
      input_schema: tool.inputSchema
        ? {
          ...tool.inputSchema,
          properties: tool.inputSchema.properties ?? {},
        }
        : { type: "object", properties: {} },
    },
    permission: "prompt",
    execute: async (input: Record<string, unknown>) => client.callTool(tool.name, input),
  };
}

export class McpManager {
  constructor(
    private readonly clients: McpClientLike[],
    readonly warnings: string[],
  ) {}

  async close(): Promise<void> {
    await Promise.all(this.clients.map(async (client) => client.close()));
  }
}

export async function createMcpManager(options: CreateMcpManagerOptions): Promise<McpManager> {
  const clients: McpClientLike[] = [];
  const warnings: string[] = [];
  const createClient = options.createClient ?? ((serverName, config) => new McpClient(serverName, config));

  for (const [serverName, config] of Object.entries(options.servers ?? {})) {
    if (config.enabled === false) {
      continue;
    }

    const client = createClient(serverName, config);

    try {
      const tools = await client.connect();
      clients.push(client);
      for (const tool of tools) {
        options.toolRegistry.register(createToolRegistration({ client, serverName, tool }));
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      warnings.push(`Warning: failed to initialize MCP server "${serverName}": ${message}`);
      await client.close().catch(() => undefined);
    }
  }

  return new McpManager(clients, warnings);
}
