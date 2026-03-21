// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MessageRole = "user" | "assistant";

export type TextBlock = {
  type: "text";
  text: string;
};

export type ToolUseBlock = {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
};

export type ToolResultBlock = {
  type: "tool_result";
  tool_use_id: string;
  content: string;
  is_error?: boolean;
};

export type ContentBlock = TextBlock | ToolUseBlock | ToolResultBlock;

export type ToolDefinition = {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
};

export type Message = {
  role: MessageRole;
  content: ContentBlock[];
};

// ---------------------------------------------------------------------------
// Anthropic SSE stream event types
// ---------------------------------------------------------------------------

export type MessageStartEvent = {
  type: "message_start";
  message: {
    id: string;
    type: "message";
    role: "assistant";
    content: [];
    model: string;
    stop_reason: string | null;
    stop_sequence: string | null;
    usage: {
      input_tokens: number;
      output_tokens: number;
    };
  };
};

export type ContentBlockStartEvent = {
  type: "content_block_start";
  index: number;
  content_block:
    | { type: "text"; text: string }
    | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> };
};

export type ContentBlockDeltaEvent = {
  type: "content_block_delta";
  index: number;
  delta:
    | { type: "text_delta"; text: string }
    | { type: "input_json_delta"; partial_json: string };
};

export type ContentBlockStopEvent = {
  type: "content_block_stop";
  index: number;
};

export type MessageDeltaEvent = {
  type: "message_delta";
  delta: {
    stop_reason: "end_turn" | "max_tokens" | "stop_sequence" | "tool_use" | null;
    stop_sequence: string | null;
  };
  usage: {
    output_tokens: number;
  };
};

export type MessageStopEvent = {
  type: "message_stop";
};

export type StreamEvent =
  | MessageStartEvent
  | ContentBlockStartEvent
  | ContentBlockDeltaEvent
  | ContentBlockStopEvent
  | MessageDeltaEvent
  | MessageStopEvent;

export type TokenUsage = {
  inputTokens: number;
  outputTokens: number;
};

export class AnthropicError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly errorType?: string,
  ) {
    super(message);
    this.name = "AnthropicError";
  }
}

const API_BASE = "https://api.anthropic.com/v1/messages";
const API_VERSION = "2023-06-01";
const DEFAULT_MAX_TOKENS = 8192;

type CreateMessageStreamOptions = {
  messages: Message[];
  model: string;
  apiKey: string;
  system?: string;
  maxTokens?: number;
  tools?: ToolDefinition[];
};

export async function createMessageStream(
  options: CreateMessageStreamOptions,
): Promise<Response> {
  const {
    messages,
    model,
    apiKey,
    system,
    maxTokens = DEFAULT_MAX_TOKENS,
    tools,
  } = options;

  if (!apiKey) {
    throw new AnthropicError("ANTHROPIC_API_KEY is not set.");
  }

  const body: Record<string, unknown> = {
    model,
    max_tokens: maxTokens,
    stream: true,
    messages,
  };

  if (system) {
    body.system = system;
  }

  if (tools && tools.length > 0) {
    body.tools = tools;
  }

  let response: Response;
  try {
    response = await fetch(API_BASE, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": API_VERSION,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : String(error);
    throw new AnthropicError(`Network error: ${message}`);
  }

  if (!response.ok) {
    let errorMessage = `HTTP ${response.status}`;
    try {
      const errorBody = (await response.json()) as { error?: { type?: string; message?: string } };
      if (errorBody.error?.message) {
        errorMessage = `${errorMessage} - ${errorBody.error.message}`;
      }
      throw new AnthropicError(
        errorMessage,
        response.status,
        errorBody.error?.type,
      );
    } catch (parseError: unknown) {
      if (parseError instanceof AnthropicError) throw parseError;
      throw new AnthropicError(errorMessage, response.status);
    }
  }

  return response;
}

type SSEEvent = {
  event: string | null;
  data: string;
};

export async function* parseSSEStream(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<SSEEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let currentEvent: string | null = null;
  let dataLines: string[] = [];

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const rawLine of lines) {
        const line = rawLine.endsWith("\r") ? rawLine.slice(0, -1) : rawLine;

        if (line === "") {
          if (currentEvent !== null || dataLines.length > 0) {
            yield {
              event: currentEvent,
              data: dataLines.join("\n"),
            };
            currentEvent = null;
            dataLines = [];
          }
          continue;
        }

        if (line.startsWith(":")) continue;

        const colonIndex = line.indexOf(":");
        if (colonIndex === -1) continue;

        const field = line.slice(0, colonIndex);
        let value = line.slice(colonIndex + 1);
        if (value.startsWith(" ")) value = value.slice(1);

        if (field === "event") {
          currentEvent = value;
        } else if (field === "data") {
          dataLines.push(value);
        }
      }
    }

    if (buffer.length > 0) {
      const line = buffer.endsWith("\r") ? buffer.slice(0, -1) : buffer;
      if (line !== "" && !line.startsWith(":")) {
        const colonIndex = line.indexOf(":");
        if (colonIndex !== -1) {
          const field = line.slice(0, colonIndex);
          let value = line.slice(colonIndex + 1);
          if (value.startsWith(" ")) value = value.slice(1);
          if (field === "event") currentEvent = value;
          else if (field === "data") dataLines.push(value);
        }
      }
    }

    if (currentEvent !== null || dataLines.length > 0) {
      yield {
        event: currentEvent,
        data: dataLines.join("\n"),
      };
    }
  } finally {
    reader.releaseLock();
  }
}

type StreamMessageOptions = {
  messages: Message[];
  model: string;
  apiKey: string;
  system?: string;
  maxTokens?: number;
  tools?: ToolDefinition[];
};

export type StreamResult = {
  usage: TokenUsage;
};

export async function* streamMessage(
  options: StreamMessageOptions,
): AsyncGenerator<StreamEvent, StreamResult> {
  const response = await createMessageStream(options);

  if (!response.body) {
    throw new AnthropicError("Response body is null — streaming not supported.");
  }

  const usage: TokenUsage = { inputTokens: 0, outputTokens: 0 };

  for await (const sse of parseSSEStream(response.body)) {
    // Discard ping events
    if (sse.event === "ping") continue;

    // Throw on error events
    if (sse.event === "error") {
      let errorMessage = "Streaming error";
      try {
        const errorData = JSON.parse(sse.data) as { error?: { type?: string; message?: string } };
        if (errorData.error?.message) {
          errorMessage = errorData.error.message;
        }
      } catch {
        // Use default error message if JSON parsing fails
      }
      throw new AnthropicError(errorMessage);
    }

    // Parse and yield typed events
    const event = JSON.parse(sse.data) as StreamEvent;

    // Extract token usage
    if (event.type === "message_start") {
      usage.inputTokens = event.message.usage.input_tokens;
    } else if (event.type === "message_delta") {
      usage.outputTokens = event.usage.output_tokens;
    }

    yield event;
  }

  return { usage };
}
