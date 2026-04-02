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

const MUTATING_TOOLS = new Set(["edit_file", "write_file", "bash", "subagent"]);

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

export function isMutatingTool(name: string): boolean {
  return MUTATING_TOOLS.has(name);
}

export function enablePlanMode(registry: ToolRegistry): void {
  for (const name of MUTATING_TOOLS) {
    const tool = registry.get(name);
    if (tool) {
      registry.register({ ...tool, permission: "deny" });
    }
  }
}

export function disablePlanMode(
  registry: ToolRegistry,
  permissionOverrides?: Record<string, ToolPermission>,
): void {
  const defaults: Record<string, ToolPermission> = {
    edit_file: "prompt",
    write_file: "prompt",
    bash: "prompt",
    subagent: "prompt",
  };

  for (const name of MUTATING_TOOLS) {
    const tool = registry.get(name);
    if (tool) {
      const permission = permissionOverrides?.[name] ?? defaults[name] ?? "prompt";
      registry.register({ ...tool, permission });
    }
  }
}
