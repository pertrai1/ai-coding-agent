import type { Message, ContentBlock } from "../api/anthropic.js";
import { runAgentLoop } from "../agent.js";
import type { ToolRegistry } from "../tools/index.js";

export type SubagentOptions = {
  task: string;
  toolRegistry: ToolRegistry;
  model: string;
  apiKey: string;
  systemPrompt?: string;
};

export type SubagentResult = {
  content: ContentBlock[];
  messages: Message[];
};

/**
 * Spawn a subagent with isolated message history.
 * The subagent runs the agent loop with its own message array,
 * executes tool calls, and returns the final result to the parent.
 */
export async function spawnSubagent(options: SubagentOptions): Promise<SubagentResult> {
  const { task, toolRegistry, model, apiKey, systemPrompt } = options;

  // Create isolated message history for this subagent
  const messages: Message[] = [
    {
      role: "user",
      content: [{ type: "text", text: task }],
    },
  ];

  // Collect output (we won't write to parent's stream)
  const output: string[] = [];
  const write = (text: string) => {
    output.push(text);
  };

  // Run the agent loop in isolation
  await runAgentLoop({
    messages,
    toolRegistry,
    model,
    apiKey,
    system: systemPrompt,
    write,
    // No promptForApproval - subagents run autonomously
    // No tokenTracker - parent tracks overall usage
  });

  // Return the final assistant message content
  const lastAssistantMessage = [...messages]
    .reverse()
    .find((m) => m.role === "assistant");

  return {
    content: lastAssistantMessage?.content ?? [],
    messages,
  };
}

/**
 * Format subagent result for display to parent agent
 */
export function formatSubagentResult(result: SubagentResult): string {
  const textBlocks = result.content
    .filter((block): block is { type: "text"; text: string } => block.type === "text")
    .map((block) => block.text)
    .join("\n");

  return textBlocks || "Subagent completed with no text output.";
}
