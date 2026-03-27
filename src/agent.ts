import { streamMessage } from "./api/anthropic.js";
import type {
  ContentBlock,
  Message,
  StreamEvent,
  ToolUseBlock,
} from "./api/anthropic.js";
import { compressConversation } from "./context/compression.js";
import type { TokenTracker } from "./context/tracker.js";
import type { ToolRegistry, ToolResult } from "./tools/index.js";

type StopReason = "end_turn" | "max_tokens" | "stop_sequence" | "tool_use" | null;

type AccumulatorResult = {
  contentBlocks: ContentBlock[];
  stopReason: StopReason;
};

export function createStreamAccumulator(
  write: (text: string) => void,
): {
  process: (event: StreamEvent) => void;
  getResult: () => AccumulatorResult;
} {
  const contentBlocks: ContentBlock[] = [];
  let jsonBuffer = "";
  let stopReason: StopReason = null;

  return {
    process(event: StreamEvent): void {
      switch (event.type) {
        case "content_block_start": {
          if (event.content_block.type === "text") {
            contentBlocks.push({ type: "text", text: event.content_block.text });
          } else if (event.content_block.type === "tool_use") {
            contentBlocks.push({
              type: "tool_use",
              id: event.content_block.id,
              name: event.content_block.name,
              input: {},
            });
            jsonBuffer = "";
          }
          break;
        }
        case "content_block_delta": {
          if (event.delta.type === "text_delta") {
            const lastBlock = contentBlocks[contentBlocks.length - 1];
            if (lastBlock && lastBlock.type === "text") {
              lastBlock.text += event.delta.text;
            }
            write(event.delta.text);
          } else if (event.delta.type === "input_json_delta") {
            jsonBuffer += event.delta.partial_json;
          }
          break;
        }
        case "content_block_stop": {
          const lastBlock = contentBlocks[contentBlocks.length - 1];
          if (lastBlock && lastBlock.type === "tool_use" && jsonBuffer) {
            try {
              lastBlock.input = JSON.parse(jsonBuffer) as Record<string, unknown>;
            } catch {
              lastBlock.input = { _parseError: `Failed to parse tool input: ${jsonBuffer}` };
            }
            jsonBuffer = "";
          }
          break;
        }
        case "message_delta": {
          stopReason = event.delta.stop_reason;
          break;
        }
        case "message_start":
        case "message_stop": {
          break;
        }
      }
    },
    getResult(): AccumulatorResult {
      return { contentBlocks: [...contentBlocks], stopReason };
    },
  };
}

const MAX_ITERATIONS = 10;

export type AgentLoopOptions = {
  messages: Message[];
  toolRegistry: ToolRegistry;
  model: string;
  apiKey: string;
  system?: string;
  write: (text: string) => void;
  tokenTracker?: TokenTracker;
  promptForApproval?: (
    toolName: string,
    toolInput: Record<string, unknown>,
  ) => Promise<boolean>;
};

export async function runAgentLoop(options: AgentLoopOptions): Promise<void> {
  const { messages, toolRegistry, model, apiKey, system, write, tokenTracker, promptForApproval } = options;
  const toolDefinitions = toolRegistry.getDefinitions();

  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration += 1) {
    if (tokenTracker?.needsCompression()) {
      await compressConversation({
        messages,
        model,
        apiKey,
        preserveTurns: 6,
        timeoutMs: 30000,
      });
      tokenTracker.resetAfterCompression(messages);
    }

    const accumulator = createStreamAccumulator(write);

    const stream = streamMessage({
      messages,
      model,
      apiKey,
      system,
      tools: toolDefinitions.length > 0 ? toolDefinitions : undefined,
    });

    let streamResult = await stream.next();
    while (!streamResult.done) {
      accumulator.process(streamResult.value);
      streamResult = await stream.next();
    }

    const usage = streamResult.value?.usage;
    if (usage && tokenTracker) {
      tokenTracker.addUsage(usage);
    }

    const { contentBlocks, stopReason } = accumulator.getResult();

    messages.push({ role: "assistant", content: contentBlocks });
    tokenTracker?.addMessage();

    if (stopReason !== "tool_use") {
      return;
    }

    const toolUseBlocks = contentBlocks.filter(
      (block): block is ToolUseBlock => block.type === "tool_use",
    );

    const toolResults: ContentBlock[] = [];

    for (const toolUse of toolUseBlocks) {
      const registration = toolRegistry.get(toolUse.name);
      let result: ToolResult;

      if (!registration) {
        result = {
          content: `Error: Tool "${toolUse.name}" not found.`,
          isError: true,
        };
      } else if (registration.permission === "deny") {
        result = {
          content: `Tool call denied: "${toolUse.name}" is not allowed.`,
          isError: true,
        };
      } else if (registration.permission === "prompt") {
        let approved = false;
        if (promptForApproval) {
          approved = await promptForApproval(toolUse.name, toolUse.input);
        }
        if (approved) {
          try {
            result = await registration.execute(toolUse.input);
          } catch (error: unknown) {
            const message = error instanceof Error ? error.message : String(error);
            result = {
              content: `Error executing tool "${toolUse.name}": ${message}`,
              isError: true,
            };
          }
        } else {
          result = {
            content: `Tool call denied by user: "${toolUse.name}".`,
            isError: true,
          };
        }
      } else {
        try {
          result = await registration.execute(toolUse.input);
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : String(error);
          result = {
            content: `Error executing tool "${toolUse.name}": ${message}`,
            isError: true,
          };
        }
      }

      toolResults.push({
        type: "tool_result",
        tool_use_id: toolUse.id,
        content: result.content,
        is_error: result.isError,
      });
    }

    messages.push({ role: "user", content: toolResults });
    tokenTracker?.addMessage();
  }

  write("\n⚠ Warning: Maximum tool-calling iterations reached.\n");
}
