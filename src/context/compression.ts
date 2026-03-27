import type { ContentBlock, Message } from "../api/anthropic.js";
import { createMessageStream, parseSSEStream } from "../api/anthropic.js";
import type { CompressionOptions, CompressionResult } from "./types.js";

const DEFAULT_PRESERVE_TURNS = 6;
const DEFAULT_TIMEOUT_MS = 30_000;
const SUMMARIZATION_SYSTEM_PROMPT =
  "You are a helpful assistant that summarizes conversations concisely while preserving key information.";
const SUMMARIZATION_PROMPT = `Summarize the following conversation turns, preserving:
1. Key decisions and their rationale
2. Files that were read, created, or modified
3. The current task or goal being worked on
4. Any important context needed to continue

Be concise but comprehensive. Focus on information over phrasing.`;

function formatMessagesForSummary(messages: Message[]): string {
  const lines: string[] = [];

  for (const message of messages) {
    const role = message.role === "user" ? "USER" : "ASSISTANT";
    const textParts: string[] = [];

    for (const block of message.content) {
      if (block.type === "text") {
        textParts.push(block.text);
      } else if (block.type === "tool_use") {
        textParts.push(`[Tool: ${block.name}(${JSON.stringify(block.input)})]`);
      } else if (block.type === "tool_result") {
        const prefix = block.is_error ? "[Tool Error: " : "[Tool Result: ";
        textParts.push(`${prefix}${block.content.slice(0, 200)}...]`);
      }
    }

    lines.push(`${role}: ${textParts.join(" ")}`);
  }

  return lines.join("\n\n");
}

async function summarizeMessages(
  messages: Message[],
  model: string,
  apiKey: string,
  timeoutMs: number,
): Promise<string> {
  const conversationText = formatMessagesForSummary(messages);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await createMessageStream({
      messages: [
        {
          role: "user",
          content: [{ type: "text", text: `${SUMMARIZATION_PROMPT}\n\n${conversationText}` }],
        },
      ],
      model,
      apiKey,
      system: SUMMARIZATION_SYSTEM_PROMPT,
      maxTokens: 2000,
      signal: controller.signal,
    });

    if (!response.body) {
      throw new Error("No response body");
    }

    let summaryText = "";

    for await (const sse of parseSSEStream(response.body)) {
      if (sse.event === "ping" || sse.event === "error") {
        continue;
      }

      try {
        const data = JSON.parse(sse.data) as {
          type: string;
          delta?: { type: string; text?: string };
        };

        if (
          data.type === "content_block_delta" &&
          data.delta?.type === "text_delta" &&
          data.delta.text
        ) {
          summaryText += data.delta.text;
        }
      } catch {
      }
    }

    return summaryText || "Summary could not be generated.";
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function compressConversation(
  options: CompressionOptions,
): Promise<CompressionResult> {
  const {
    messages,
    model,
    apiKey,
    preserveTurns = DEFAULT_PRESERVE_TURNS,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  } = options;

  const messagesBefore = messages.length;

  if (messages.length <= preserveTurns) {
    return {
      success: true,
      messagesBefore,
      messagesAfter: messages.length,
    };
  }

  const toCompress = messages.slice(0, -preserveTurns);
  const toPreserve = messages.slice(-preserveTurns);

  let summaryText: string;

  try {
    summaryText = await summarizeMessages(toCompress, model, apiKey, timeoutMs);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[Context Compression] Summarization failed: ${errorMessage}`);

    const truncatedMessages = toPreserve;
    messages.length = 0;
    messages.push(...truncatedMessages);

    return {
      success: false,
      messagesBefore,
      messagesAfter: messages.length,
      error: errorMessage,
    };
  }

  const summaryMessage: Message = {
    role: "user",
    content: [{ type: "text", text: `[Earlier conversation summary]\n${summaryText}` }],
  };

  messages.length = 0;
  messages.push(summaryMessage, ...toPreserve);

  return {
    success: true,
    messagesBefore,
    messagesAfter: messages.length,
  };
}
