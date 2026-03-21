import type { ToolDefinition } from "../api/anthropic.js";
import { readFileTool } from "./read-file.js";

export type { ToolDefinition };

export type ToolResult = {
  content: string;
  isError?: boolean;
};

export type ToolExecutor = (input: Record<string, unknown>) => Promise<ToolResult>;

export type ToolRegistration = {
  definition: ToolDefinition;
  execute: ToolExecutor;
};

export type ToolRegistry = {
  register: (tool: ToolRegistration) => void;
  get: (name: string) => ToolRegistration | undefined;
  getDefinitions: () => ToolDefinition[];
};

export function createToolRegistry(): ToolRegistry {
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

  return registry;
}
