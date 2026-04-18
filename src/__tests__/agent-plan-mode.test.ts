import { beforeEach, describe, expect, it, vi } from "vitest";

import { streamMessage } from "../api/anthropic.js";
import type { Message, StreamEvent } from "../api/anthropic.js";
import { runAgentLoop } from "../agent.js";
import { createToolRegistry } from "../tools/index.js";

vi.mock("../api/anthropic.js", async () => {
  const actual = await vi.importActual<typeof import("../api/anthropic.js")>(
    "../api/anthropic.js",
  );
  return {
    ...actual,
    streamMessage: vi.fn(),
  };
});

function createStreamFromEvents(
  events: StreamEvent[],
): AsyncGenerator<StreamEvent, { usage: { inputTokens: number; outputTokens: number } }> {
  return (async function* () {
    for (const event of events) {
      yield event;
    }
    return {
      usage: {
        inputTokens: 0,
        outputTokens: 0,
      },
    };
  })();
}

function mockToolUseThenTextResponse(toolName: string, toolInputJson: string, finalText: string): void {
  const streamMock = vi.mocked(streamMessage);
  streamMock
    .mockImplementationOnce(() =>
      createStreamFromEvents([
        {
          type: "content_block_start",
          index: 0,
          content_block: { type: "tool_use", id: "tool_1", name: toolName, input: {} },
        },
        {
          type: "content_block_delta",
          index: 0,
          delta: { type: "input_json_delta", partial_json: toolInputJson },
        },
        { type: "content_block_stop", index: 0 },
        {
          type: "message_delta",
          delta: { stop_reason: "tool_use", stop_sequence: null },
          usage: { output_tokens: 4 },
        },
        { type: "message_stop" },
      ]),
    )
    .mockImplementationOnce(() =>
      createStreamFromEvents([
        {
          type: "content_block_start",
          index: 0,
          content_block: { type: "text", text: "" },
        },
        {
          type: "content_block_delta",
          index: 0,
          delta: { type: "text_delta", text: finalText },
        },
        { type: "content_block_stop", index: 0 },
        {
          type: "message_delta",
          delta: { stop_reason: "end_turn", stop_sequence: null },
          usage: { output_tokens: 2 },
        },
        { type: "message_stop" },
      ]),
    );
}

describe("agent plan mode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a denial result when isToolDenied returns true", async () => {
    mockToolUseThenTextResponse("test_tool", '{"target":"file.txt"}', "Plan acknowledged.");

    const execute = vi.fn<(input: Record<string, unknown>) => Promise<{ content: string }>>();
    const registry = createToolRegistry();
    registry.register({
      definition: {
        name: "test_tool",
        description: "Test tool",
        input_schema: { type: "object", properties: {} },
      },
      permission: "allow",
      execute,
    });

    const messages: Message[] = [{ role: "user", content: [{ type: "text", text: "Use the tool." }] }];

    await runAgentLoop({
      messages,
      toolRegistry: registry,
      model: "claude-sonnet-4-20250514",
      apiKey: "test-key",
      write: vi.fn(),
      isToolDenied: (toolName) => toolName === "test_tool",
    });

    expect(execute).not.toHaveBeenCalled();
    expect(messages[2]).toEqual({
      role: "user",
      content: [
        {
          type: "tool_result",
          tool_use_id: "tool_1",
          content: expect.stringContaining("plan mode"),
          is_error: true,
        },
      ],
    });
  });

  it("executes the tool normally when isToolDenied returns false", async () => {
    mockToolUseThenTextResponse("test_tool", '{"target":"file.txt"}', "Done.");

    const execute = vi
      .fn<(input: Record<string, unknown>) => Promise<{ content: string }>>()
      .mockResolvedValue({ content: "Tool output" });

    const registry = createToolRegistry();
    registry.register({
      definition: {
        name: "test_tool",
        description: "Test tool",
        input_schema: { type: "object", properties: {} },
      },
      permission: "allow",
      execute,
    });

    const messages: Message[] = [{ role: "user", content: [{ type: "text", text: "Use the tool." }] }];

    await runAgentLoop({
      messages,
      toolRegistry: registry,
      model: "claude-sonnet-4-20250514",
      apiKey: "test-key",
      write: vi.fn(),
      isToolDenied: () => false,
    });

    expect(execute).toHaveBeenCalledWith({ target: "file.txt" });
    expect(messages[2]).toEqual({
      role: "user",
      content: [
        {
          type: "tool_result",
          tool_use_id: "tool_1",
          content: "Tool output",
          is_error: undefined,
        },
      ],
    });
  });

  it("uses the normal permission flow when isToolDenied is not provided", async () => {
    mockToolUseThenTextResponse("test_tool", '{"target":"file.txt"}', "Done.");

    const promptForApproval = vi.fn<(toolName: string, toolInput: Record<string, unknown>) => Promise<boolean>>()
      .mockResolvedValue(true);
    const execute = vi
      .fn<(input: Record<string, unknown>) => Promise<{ content: string }>>()
      .mockResolvedValue({ content: "Approved output" });

    const registry = createToolRegistry();
    registry.register({
      definition: {
        name: "test_tool",
        description: "Test tool",
        input_schema: { type: "object", properties: {} },
      },
      permission: "prompt",
      execute,
    });

    const messages: Message[] = [{ role: "user", content: [{ type: "text", text: "Use the tool." }] }];

    await runAgentLoop({
      messages,
      toolRegistry: registry,
      model: "claude-sonnet-4-20250514",
      apiKey: "test-key",
      write: vi.fn(),
      promptForApproval,
    });

    expect(promptForApproval).toHaveBeenCalledWith("test_tool", { target: "file.txt" });
    expect(execute).toHaveBeenCalledWith({ target: "file.txt" });
    expect(messages[2]).toEqual({
      role: "user",
      content: [
        {
          type: "tool_result",
          tool_use_id: "tool_1",
          content: "Approved output",
          is_error: undefined,
        },
      ],
    });
  });

  it("checks isToolDenied before the permission check", async () => {
    mockToolUseThenTextResponse("test_tool", '{"target":"file.txt"}', "Done.");

    const execute = vi.fn<(input: Record<string, unknown>) => Promise<{ content: string }>>();
    const isToolDenied = vi.fn<(toolName: string) => boolean>().mockReturnValue(true);

    const registry = createToolRegistry();
    registry.register({
      definition: {
        name: "test_tool",
        description: "Test tool",
        input_schema: { type: "object", properties: {} },
      },
      permission: "allow",
      execute,
    });

    const messages: Message[] = [{ role: "user", content: [{ type: "text", text: "Use the tool." }] }];

    await runAgentLoop({
      messages,
      toolRegistry: registry,
      model: "claude-sonnet-4-20250514",
      apiKey: "test-key",
      write: vi.fn(),
      isToolDenied,
    });

    expect(isToolDenied).toHaveBeenCalledWith("test_tool");
    expect(execute).not.toHaveBeenCalled();
    expect(messages[2].content[0]).toEqual({
      type: "tool_result",
      tool_use_id: "tool_1",
      content: expect.stringContaining("plan mode"),
      is_error: true,
    });
  });
});
