import type { ToolRegistration, ToolResult } from "../tools/index.js";
import { spawnSubagent, formatSubagentResult } from "./index.js";

export type SubagentToolConfig = {
  toolRegistry: Parameters<typeof spawnSubagent>[0]["toolRegistry"];
  model: string;
  apiKey: string;
  systemPrompt?: string;
};

/**
 * Create a subagent tool that can be registered in the tool registry.
 * This allows the main agent to spawn subagents for specific tasks.
 */
export function createSubagentTool(config: SubagentToolConfig): ToolRegistration {
  return {
    definition: {
      name: "subagent",
      description:
        "Spawn a focused subagent to handle a specific task. The subagent has isolated message history and access to the same tools. Use for complex tasks that benefit from isolation or parallel execution.",
      input_schema: {
        type: "object",
        properties: {
          task: {
            type: "string",
            description: "The task prompt to send to the subagent",
          },
        },
        required: ["task"],
      },
    },
    execute: async (input: Record<string, unknown>): Promise<ToolResult> => {
      const task = input.task as string | undefined;

      if (!task || typeof task !== "string") {
        return {
          content: "Error: 'task' parameter is required and must be a string.",
          isError: true,
        };
      }

      try {
        const result = await spawnSubagent({
          task,
          toolRegistry: config.toolRegistry,
          model: config.model,
          apiKey: config.apiKey,
          systemPrompt: config.systemPrompt,
        });

        return {
          content: formatSubagentResult(result),
        };
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: `Subagent error: ${message}`,
          isError: true,
        };
      }
    },
    permission: "prompt", // Require approval before spawning subagents
  };
}
