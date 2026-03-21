import { streamMessage } from "./api/anthropic.js";
import type {
  ContentBlock,
  Message,
  StreamEvent,
  ToolUseBlock,
} from "./api/anthropic.js";
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
};

export async function runAgentLoop(options: AgentLoopOptions): Promise<void> {
  const { messages, toolRegistry, model, apiKey, system, write } = options;
  const toolDefinitions = toolRegistry.getDefinitions();

  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration += 1) {
    const accumulator = createStreamAccumulator(write);

    const stream = streamMessage({
      messages,
      model,
      apiKey,
      system,
      tools: toolDefinitions.length > 0 ? toolDefinitions : undefined,
    });

    for await (const event of stream) {
      accumulator.process(event);
    }

    const { contentBlocks, stopReason } = accumulator.getResult();

    messages.push({ role: "assistant", content: contentBlocks });

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
  }

  write("\n⚠ Warning: Maximum tool-calling iterations reached.\n");
}
