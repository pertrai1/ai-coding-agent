import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  AnthropicError,
  createMessageStream,
  parseSSEStream,
  streamMessage,
} from "../api/anthropic.js";

function createSSEStream(text: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(text));
      controller.close();
    },
  });
}

async function collectEvents<T>(gen: AsyncGenerator<T>): Promise<T[]> {
  const events: T[] = [];
  for await (const event of gen) {
    events.push(event);
  }
  return events;
}

function createStreamingResponse(text: string): Response {
  return new Response(createSSEStream(text), { status: 200 });
}

describe("Anthropic client", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("parseSSEStream", () => {
    it("parses a basic event/data message", async () => {
      const stream = createSSEStream(
        "event: content_block_delta\ndata: {\"type\":\"content_block_delta\"}\n\n",
      );

      const events = await collectEvents(parseSSEStream(stream));

      expect(events).toEqual([
        {
          event: "content_block_delta",
          data: '{"type":"content_block_delta"}',
        },
      ]);
    });

    it("separates multiple events by blank lines", async () => {
      const stream = createSSEStream(
        "event: ping\ndata:\n\n" +
          "event: content_block_delta\n" +
          "data: {\"type\":\"content_block_delta\"}\n\n",
      );

      const events = await collectEvents(parseSSEStream(stream));

      expect(events).toEqual([
        { event: "ping", data: "" },
        {
          event: "content_block_delta",
          data: '{"type":"content_block_delta"}',
        },
      ]);
    });

    it("handles CRLF line endings", async () => {
      const stream = createSSEStream(
        "event: content_block_delta\r\n" +
          "data: {\"type\":\"content_block_delta\"}\r\n\r\n",
      );

      const events = await collectEvents(parseSSEStream(stream));

      expect(events).toEqual([
        {
          event: "content_block_delta",
          data: '{"type":"content_block_delta"}',
        },
      ]);
    });

    it("joins multiple data lines with newlines", async () => {
      const stream = createSSEStream(
        "event: content_block_delta\n" +
          "data: first line\n" +
          "data: second line\n\n",
      );

      const events = await collectEvents(parseSSEStream(stream));

      expect(events).toEqual([
        {
          event: "content_block_delta",
          data: "first line\nsecond line",
        },
      ]);
    });

    it("yields ping events without filtering", async () => {
      const stream = createSSEStream("event: ping\ndata:\n\n");

      const events = await collectEvents(parseSSEStream(stream));

      expect(events).toEqual([{ event: "ping", data: "" }]);
    });

    it("ignores comment lines", async () => {
      const stream = createSSEStream(
        ": keepalive\n" +
          "event: content_block_delta\n" +
          "data: {\"type\":\"content_block_delta\"}\n\n",
      );

      const events = await collectEvents(parseSSEStream(stream));

      expect(events).toEqual([
        {
          event: "content_block_delta",
          data: '{"type":"content_block_delta"}',
        },
      ]);
    });
  });

  describe("createMessageStream", () => {
    it("builds request with expected URL/body/headers", async () => {
      const mockResponse = new Response(null, { status: 200 });
      const fetchMock = vi.fn().mockResolvedValue(mockResponse);
      vi.stubGlobal("fetch", fetchMock);

      const messages = [
        { role: "user" as const, content: "hello" },
        { role: "assistant" as const, content: "hi" },
        { role: "user" as const, content: "continue" },
      ];

      await createMessageStream({
        messages,
        model: "claude-sonnet-4-5",
        apiKey: "test-key",
        system: "You are concise.",
        maxTokens: 123,
      });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledWith(
        "https://api.anthropic.com/v1/messages",
        expect.objectContaining({
          method: "POST",
          headers: {
            "x-api-key": "test-key",
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
          },
        }),
      );

      const [, requestInit] = fetchMock.mock.calls[0] ?? [];
      expect(requestInit).toBeDefined();

      if (!requestInit || typeof requestInit !== "object") {
        throw new Error("Expected fetch RequestInit object");
      }

      const body = JSON.parse(String(requestInit.body)) as {
        model: string;
        max_tokens: number;
        stream: boolean;
        messages: Array<{ role: "user" | "assistant"; content: string }>;
        system?: string;
      };

      expect(body).toEqual({
        model: "claude-sonnet-4-5",
        max_tokens: 123,
        stream: true,
        messages,
        system: "You are concise.",
      });
      expect(body.messages).toEqual(messages);
    });

    it("omits system field when not provided", async () => {
      const mockResponse = new Response(null, { status: 200 });
      const fetchMock = vi.fn().mockResolvedValue(mockResponse);
      vi.stubGlobal("fetch", fetchMock);

      await createMessageStream({
        messages: [{ role: "user", content: "hello" }],
        model: "claude-sonnet-4-5",
        apiKey: "test-key",
      });

      const [, requestInit] = fetchMock.mock.calls[0] ?? [];
      expect(requestInit).toBeDefined();

      if (!requestInit || typeof requestInit !== "object") {
        throw new Error("Expected fetch RequestInit object");
      }

      const body = JSON.parse(String(requestInit.body)) as {
        system?: string;
      };

      expect(body.system).toBeUndefined();
    });
  });

  describe("error handling", () => {
    it("throws AnthropicError with status and type for non-2xx response", async () => {
      const mockResponse = new Response(
        JSON.stringify({
          error: {
            type: "authentication_error",
            message: "invalid api key",
          },
        }),
        {
          status: 401,
          headers: { "content-type": "application/json" },
        },
      );
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse));

      await expect(
        createMessageStream({
          messages: [{ role: "user", content: "hello" }],
          model: "claude-sonnet-4-5",
          apiKey: "bad-key",
        }),
      ).rejects.toMatchObject({
        name: "AnthropicError",
        message: "HTTP 401 - invalid api key",
        statusCode: 401,
        errorType: "authentication_error",
      });
    });

    it("wraps fetch rejections as AnthropicError network errors", async () => {
      vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));

      await expect(
        createMessageStream({
          messages: [{ role: "user", content: "hello" }],
          model: "claude-sonnet-4-5",
          apiKey: "test-key",
        }),
      ).rejects.toThrow("Network error: fetch failed");
      await expect(
        createMessageStream({
          messages: [{ role: "user", content: "hello" }],
          model: "claude-sonnet-4-5",
          apiKey: "test-key",
        }),
      ).rejects.toBeInstanceOf(AnthropicError);
    });

    it("throws when api key is missing", async () => {
      await expect(
        createMessageStream({
          messages: [{ role: "user", content: "hello" }],
          model: "claude-sonnet-4-5",
          apiKey: "",
        }),
      ).rejects.toThrow("ANTHROPIC_API_KEY is not set.");
    });
  });

  describe("streamMessage", () => {
    it("discards ping events and yields real events", async () => {
      const sse =
        "event: ping\ndata:\n\n" +
        "event: content_block_delta\n" +
        "data: {\"type\":\"content_block_delta\",\"index\":0,\"delta\":{\"type\":\"text_delta\",\"text\":\"hello\"}}\n\n";
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(createStreamingResponse(sse)));

      const events = await collectEvents(
        streamMessage({
          messages: [{ role: "user", content: "hello" }],
          model: "claude-sonnet-4-5",
          apiKey: "test-key",
        }),
      );

      expect(events).toEqual([
        {
          type: "content_block_delta",
          index: 0,
          delta: {
            type: "text_delta",
            text: "hello",
          },
        },
      ]);
    });

    it("throws AnthropicError on SSE error events", async () => {
      const sse =
        "event: error\n" +
        "data: {\"error\":{\"type\":\"server_error\",\"message\":\"overloaded\"}}\n\n";
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(createStreamingResponse(sse)));

      const consume = async (): Promise<void> => {
        for await (const _event of streamMessage({
          messages: [{ role: "user", content: "hello" }],
          model: "claude-sonnet-4-5",
          apiKey: "test-key",
        })) {
          void _event;
        }
      };

      await expect(consume()).rejects.toMatchObject({
        name: "AnthropicError",
        message: "overloaded",
      });
    });

    it("returns usage totals from message_start and message_delta", async () => {
      const sse =
        "event: message_start\n" +
        "data: {\"type\":\"message_start\",\"message\":{\"id\":\"msg_1\",\"type\":\"message\",\"role\":\"assistant\",\"content\":[],\"model\":\"claude\",\"stop_reason\":null,\"stop_sequence\":null,\"usage\":{\"input_tokens\":12,\"output_tokens\":0}}}\n\n" +
        "event: message_delta\n" +
        "data: {\"type\":\"message_delta\",\"delta\":{\"stop_reason\":\"end_turn\",\"stop_sequence\":null},\"usage\":{\"output_tokens\":34}}\n\n" +
        "event: message_stop\n" +
        "data: {\"type\":\"message_stop\"}\n\n";

      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(createStreamingResponse(sse)));

      const generator = streamMessage({
        messages: [{ role: "user", content: "hello" }],
        model: "claude-sonnet-4-5",
        apiKey: "test-key",
      });

      const yieldedTypes: string[] = [];

      while (true) {
        const next = await generator.next();
        if (next.done) {
          expect(yieldedTypes).toEqual(["message_start", "message_delta", "message_stop"]);
          expect(next.value).toEqual({
            usage: {
              inputTokens: 12,
              outputTokens: 34,
            },
          });
          break;
        }

        yieldedTypes.push(next.value.type);
      }
    });
  });
});
