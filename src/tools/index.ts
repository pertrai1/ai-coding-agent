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
  getAll: () => ToolRegistration[];
  getDefinitions: () => ToolDefinition[];
};

export function createToolRegistry(
  permissionOverrides?: Record<string, ToolPermission>,
  options: { includeDefaults?: boolean } = {},
): ToolRegistry {
  const tools = new Map<string, ToolRegistration>();
  const includeDefaults = options.includeDefaults ?? true;

  function applyPermission(tool: ToolRegistration): ToolRegistration {
    const permission = permissionOverrides?.[tool.definition.name] ?? tool.permission;
    return permission === undefined ? tool : { ...tool, permission };
  }

  const registry: ToolRegistry = {
    register(tool: ToolRegistration): void {
      tools.set(tool.definition.name, applyPermission(tool));
    },
    get(name: string): ToolRegistration | undefined {
      return tools.get(name);
    },
    getAll(): ToolRegistration[] {
      return Array.from(tools.values());
    },
    getDefinitions(): ToolDefinition[] {
      return Array.from(tools.values()).map((tool) => tool.definition);
    },
  };

  if (includeDefaults) {
    registry.register(readFileTool);
    registry.register(editFileTool);
    registry.register(writeFileTool);
    registry.register(globTool);
    registry.register(grepTool);
    registry.register(bashTool);
  }

  return registry;
}
