import { beforeEach, describe, expect, it, vi } from "vitest";

import { createMessageStream } from "../../api/anthropic.js";
import type { Message } from "../../api/anthropic.js";
import { compressConversation } from "../../context/compression.js";

vi.mock("../../api/anthropic.js", async () => {
  const actual = await vi.importActual<typeof import("../../api/anthropic.js")>(
    "../../api/anthropic.js",
  );

  return {
    ...actual,
    createMessageStream: vi.fn(),
  };
});

function createMockResponse(text: string): Response {
  const encoder = new TextEncoder();
  const events = [
    "event: content_block_start\ndata: {\"type\":\"content_block_start\",\"index\":0,\"content_block\":{\"type\":\"text\",\"text\":\"\"}}\n\n",
    ...text.split("").map((char) => `event: content_block_delta\ndata: ${JSON.stringify({ type: "content_block_delta", index: 0, delta: { type: "text_delta", text: char } })}\n\n`),
    "event: content_block_stop\ndata: {\"type\":\"content_block_stop\",\"index\":0}\n\n",
    "event: message_delta\ndata: {\"type\":\"message_delta\",\"delta\":{\"stop_reason\":\"end_turn\",\"stop_sequence\":null},\"usage\":{\"output_tokens\":10}}\n\n",
    "event: message_stop\ndata: {\"type\":\"message_stop\"}\n\n",
  ];

  const body = new ReadableStream({
    start(controller) {
      for (const event of events) {
        controller.enqueue(encoder.encode(event));
      }
      controller.close();
    },
  });

  return { body, ok: true } as Response;
}

function createSplitChunkResponse(text: string): Response {
  const encoder = new TextEncoder();
  const events = [
    `event: content_block_delta\ndata: ${JSON.stringify({ type: "content_block_delta", index: 0, delta: { type: "text_delta", text } })}\n\n`,
    "event: message_stop\ndata: {\"type\":\"message_stop\"}\n\n",
  ];
  const payload = events.join("");

  const body = new ReadableStream({
    start(controller) {
      const splitIndex = Math.floor(payload.length / 2);
      controller.enqueue(encoder.encode(payload.slice(0, splitIndex)));
      controller.enqueue(encoder.encode(payload.slice(splitIndex)));
      controller.close();
    },
  });

  return { body, ok: true } as Response;
}

function createMessages(count: number): Message[] {
  return Array.from({ length: count }, (_, i) => ({
    role: i % 2 === 0 ? "user" as const : "assistant" as const,
    content: [{ type: "text" as const, text: `Message ${i + 1}` }],
  }));
}

describe("compressConversation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not compress when messages <= preserveTurns", async () => {
    const messages = createMessages(6);

    const result = await compressConversation({
      messages,
      model: "claude-sonnet-4-20250514",
      apiKey: "test-key",
      preserveTurns: 6,
      timeoutMs: 30000,
    });

    expect(result.success).toBe(true);
    expect(result.messagesBefore).toBe(6);
    expect(result.messagesAfter).toBe(6);
    expect(messages.length).toBe(6);
    expect(createMessageStream).not.toHaveBeenCalled();
  });

  it("compresses when messages > preserveTurns", async () => {
    vi.mocked(createMessageStream).mockResolvedValue(createMockResponse("Summary of conversation"));

    const messages = createMessages(10);

    const result = await compressConversation({
      messages,
      model: "claude-sonnet-4-20250514",
      apiKey: "test-key",
      preserveTurns: 6,
      timeoutMs: 30000,
    });

    expect(result.success).toBe(true);
    expect(result.messagesBefore).toBe(10);
    expect(result.messagesAfter).toBe(7);
    expect(messages.length).toBe(7);
    expect(messages[0].role).toBe("user");
    expect(messages[0].content[0]).toMatchObject({
      type: "text",
      text: expect.stringContaining("Summary of conversation"),
    });
  });

  it("preserves recent 6 turns verbatim", async () => {
    vi.mocked(createMessageStream).mockResolvedValue(createMockResponse("Summary"));

    const messages = createMessages(12);
    const originalRecent = messages.slice(-6).map((m) => ({ ...m, content: [...m.content] }));

    await compressConversation({
      messages,
      model: "claude-sonnet-4-20250514",
      apiKey: "test-key",
      preserveTurns: 6,
      timeoutMs: 30000,
    });

    for (let i = 0; i < 6; i++) {
      expect(messages[1 + i]).toEqual(originalRecent[i]);
    }
  });

  it("falls back to truncation when summarization fails", async () => {
    vi.mocked(createMessageStream).mockRejectedValue(new Error("API error"));

    const messages = createMessages(10);

    const result = await compressConversation({
      messages,
      model: "claude-sonnet-4-20250514",
      apiKey: "test-key",
      preserveTurns: 6,
      timeoutMs: 30000,
    });

    expect(result.success).toBe(false);
    expect(result.messagesBefore).toBe(10);
    expect(result.messagesAfter).toBe(6);
    expect(result.error).toBe("API error");
    expect(messages.length).toBe(6);
  });

  it("prefixes summary with marker", async () => {
    vi.mocked(createMessageStream).mockResolvedValue(createMockResponse("Summary text"));

    const messages = createMessages(8);

    await compressConversation({
      messages,
      model: "claude-sonnet-4-20250514",
      apiKey: "test-key",
      preserveTurns: 6,
      timeoutMs: 30000,
    });

    expect(messages[0].content[0]).toMatchObject({
      type: "text",
      text: expect.stringContaining("[Earlier conversation summary]"),
    });
  });

  it("formats tool_use blocks in conversation for summarization", async () => {
    vi.mocked(createMessageStream).mockResolvedValue(createMockResponse("Summary"));

    const messages: Message[] = [
      { role: "user", content: [{ type: "text", text: "Read the file" }] },
      {
        role: "assistant",
        content: [
          { type: "tool_use", id: "t1", name: "read_file", input: { filePath: "test.ts" } },
        ],
      },
      {
        role: "user",
        content: [
          { type: "tool_result", tool_use_id: "t1", content: "file contents here" },
        ],
      },
      { role: "assistant", content: [{ type: "text", text: "Done" }] },
      { role: "user", content: [{ type: "text", text: "Recent 1" }] },
      { role: "assistant", content: [{ type: "text", text: "Recent 2" }] },
    ];

    await compressConversation({
      messages,
      model: "claude-sonnet-4-20250514",
      apiKey: "test-key",
      preserveTurns: 2,
      timeoutMs: 30000,
    });

    const callArgs = vi.mocked(createMessageStream).mock.calls[0][0];
    const summarizationText = (callArgs.messages[0].content[0] as { text: string }).text;

    expect(summarizationText).toContain("[Tool: read_file");
    expect(summarizationText).toContain("[Tool Result:");
  });

  it("passes an AbortSignal to summarization request", async () => {
    vi.mocked(createMessageStream).mockResolvedValue(createMockResponse("Summary"));
    const messages = createMessages(8);

    await compressConversation({
      messages,
      model: "claude-sonnet-4-20250514",
      apiKey: "test-key",
      preserveTurns: 6,
      timeoutMs: 30000,
    });

    const callArgs = vi.mocked(createMessageStream).mock.calls[0][0];
    expect(callArgs.signal).toBeDefined();
  });

  it("handles split SSE chunks while building summary text", async () => {
    vi.mocked(createMessageStream).mockResolvedValue(createSplitChunkResponse("Chunked summary"));
    const messages = createMessages(8);

    await compressConversation({
      messages,
      model: "claude-sonnet-4-20250514",
      apiKey: "test-key",
      preserveTurns: 6,
      timeoutMs: 30000,
    });

    expect(messages[0].content[0]).toMatchObject({
      type: "text",
      text: expect.stringContaining("Chunked summary"),
    });
  });
});
