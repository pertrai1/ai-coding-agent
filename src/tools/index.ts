import type { ToolDefinition } from "../api/anthropic.js";
import { bashTool } from "./bash.js";
import { editFileTool } from "./editFileTool.js";
import { globTool } from "./glob.js";
import { grepTool } from "./grep.js";
import { readFileTool } from "./readFileTool.js";
import { writeFileTool } from "./writeFileTool.js";

export type { ToolDefinition };

export type ToolResult = {
  content: string;
  isError?: boolean;
};

export type ToolPermission = "allow" | "prompt" | "deny";

export type ToolExecutor = (input: Record<string, unknown>) => Promise<ToolResult>;

export type ToolRegistration = {
  definition: ToolDefinition;
  execute: ToolExecutor;
  permission?: ToolPermission;
};

export type ToolRegistry = {
  register: (tool: ToolRegistration) => void;
  get: (name: string) => ToolRegistration | undefined;
  getDefinitions: () => ToolDefinition[];
};

export function createToolRegistry(
  permissionOverrides?: Record<string, ToolPermission>,
): ToolRegistry {
  const tools = new Map<string, ToolRegistration>();

  const registry: ToolRegistry = {
    register(tool: ToolRegistration): void {
      tools.set(tool.definition.name, tool);
    },
    get(name: string): ToolRegistration | undefined {
      return tools.get(name);
    },
    getDefinitions(): ToolDefinition[] {
      return Array.from(tools.values()).map((tool) => tool.definition);
    },
  };

  registry.register(readFileTool);
  registry.register(editFileTool);
  registry.register(writeFileTool);
  registry.register(globTool);
  registry.register(grepTool);
  registry.register(bashTool);

  if (permissionOverrides) {
    for (const [toolName, permission] of Object.entries(permissionOverrides)) {
      const tool = tools.get(toolName);
      if (tool) {
        tools.set(toolName, { ...tool, permission });
      }
    }
  }

  return registry;
}
