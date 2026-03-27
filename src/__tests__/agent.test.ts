import { beforeEach, describe, expect, it, vi } from "vitest";

import { streamMessage } from "../api/anthropic.js";
import type { Message, StreamEvent } from "../api/anthropic.js";
import { createStreamAccumulator, runAgentLoop } from "../agent.js";
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

describe("createStreamAccumulator", () => {
  it("accumulates text-only stream events", () => {
    const write = vi.fn<(text: string) => void>();
    const accumulator = createStreamAccumulator(write);

    accumulator.process({
      type: "content_block_start",
      index: 0,
      content_block: { type: "text", text: "" },
    });
    accumulator.process({
      type: "content_block_delta",
      index: 0,
      delta: { type: "text_delta", text: "Hello" },
    });
    accumulator.process({
      type: "content_block_delta",
      index: 0,
      delta: { type: "text_delta", text: " world" },
    });
    accumulator.process({ type: "content_block_stop", index: 0 });
    accumulator.process({
      type: "message_delta",
      delta: { stop_reason: "end_turn", stop_sequence: null },
      usage: { output_tokens: 2 },
    });

    expect(accumulator.getResult()).toEqual({
      contentBlocks: [{ type: "text", text: "Hello world" }],
      stopReason: "end_turn",
    });
    expect(write).toHaveBeenNthCalledWith(1, "Hello");
    expect(write).toHaveBeenNthCalledWith(2, " world");
  });

  it("accumulates tool_use JSON input from deltas", () => {
    const write = vi.fn<(text: string) => void>();
    const accumulator = createStreamAccumulator(write);

    accumulator.process({
      type: "content_block_start",
      index: 0,
      content_block: { type: "tool_use", id: "t1", name: "read_file", input: {} },
    });
    accumulator.process({
      type: "content_block_delta",
      index: 0,
      delta: { type: "input_json_delta", partial_json: '{"file' },
    });
    accumulator.process({
      type: "content_block_delta",
      index: 0,
      delta: { type: "input_json_delta", partial_json: 'Path":"test.ts"}' },
    });
    accumulator.process({ type: "content_block_stop", index: 0 });
    accumulator.process({
      type: "message_delta",
      delta: { stop_reason: "tool_use", stop_sequence: null },
      usage: { output_tokens: 1 },
    });

    expect(accumulator.getResult()).toEqual({
      contentBlocks: [
        {
          type: "tool_use",
          id: "t1",
          name: "read_file",
          input: { filePath: "test.ts" },
        },
      ],
      stopReason: "tool_use",
    });
    expect(write).not.toHaveBeenCalled();
  });

  it("preserves mixed text and tool_use blocks order", () => {
    const write = vi.fn<(text: string) => void>();
    const accumulator = createStreamAccumulator(write);

    accumulator.process({
      type: "content_block_start",
      index: 0,
      content_block: { type: "text", text: "" },
    });
    accumulator.process({
      type: "content_block_delta",
      index: 0,
      delta: { type: "text_delta", text: "Read " },
    });
    accumulator.process({ type: "content_block_stop", index: 0 });

    accumulator.process({
      type: "content_block_start",
      index: 1,
      content_block: { type: "tool_use", id: "t2", name: "read_file", input: {} },
    });
    accumulator.process({
      type: "content_block_delta",
      index: 1,
      delta: { type: "input_json_delta", partial_json: '{"filePath":"a.ts"}' },
    });
    accumulator.process({ type: "content_block_stop", index: 1 });

    expect(accumulator.getResult().contentBlocks).toEqual([
      { type: "text", text: "Read " },
      { type: "tool_use", id: "t2", name: "read_file", input: { filePath: "a.ts" } },
    ]);
  });

  it("stores parse error metadata for malformed tool JSON", () => {
    const write = vi.fn<(text: string) => void>();
    const accumulator = createStreamAccumulator(write);

    accumulator.process({
      type: "content_block_start",
      index: 0,
      content_block: { type: "tool_use", id: "t3", name: "read_file", input: {} },
    });
    accumulator.process({
      type: "content_block_delta",
      index: 0,
      delta: { type: "input_json_delta", partial_json: "{bad-json" },
    });
    accumulator.process({ type: "content_block_stop", index: 0 });

    const [toolUseBlock] = accumulator.getResult().contentBlocks;
    if (!toolUseBlock || toolUseBlock.type !== "tool_use") {
      throw new Error("Expected a tool_use block");
    }

    expect(toolUseBlock.input).toMatchObject({
      _parseError: expect.stringContaining("Failed to parse tool input"),
    });
  });
});

describe("runAgentLoop", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("handles a single text response without tool use", async () => {
    const streamMock = vi.mocked(streamMessage);
    streamMock.mockImplementation(async function* () {
      yield {
        type: "content_block_start",
        index: 0,
        content_block: { type: "text", text: "" },
      };
      yield {
        type: "content_block_delta",
        index: 0,
        delta: { type: "text_delta", text: "Hello" },
      };
      yield { type: "content_block_stop", index: 0 };
      yield {
        type: "message_delta",
        delta: { stop_reason: "end_turn", stop_sequence: null },
        usage: { output_tokens: 5 },
      };
      yield { type: "message_stop" };
      return { usage: { inputTokens: 10, outputTokens: 5 } };
    });

    const messages: Message[] = [{ role: "user", content: [{ type: "text", text: "Hi" }] }];
    const write = vi.fn<(text: string) => void>();

    await runAgentLoop({
      messages,
      toolRegistry: createToolRegistry(),
      model: "claude-sonnet-4-20250514",
      apiKey: "test-key",
      write,
    });

    expect(messages).toHaveLength(2);
    expect(messages[1]).toEqual({ role: "assistant", content: [{ type: "text", text: "Hello" }] });
    expect(write).toHaveBeenCalledWith("Hello");
    expect(streamMock).toHaveBeenCalledTimes(1);
  });

  it("executes tool call then continues to text response", async () => {
    const streamMock = vi.mocked(streamMessage);
    streamMock
      .mockImplementationOnce(() =>
        createStreamFromEvents([
          {
            type: "content_block_start",
            index: 0,
            content_block: { type: "tool_use", id: "tool_1", name: "test_tool", input: {} },
          },
          {
            type: "content_block_delta",
            index: 0,
            delta: { type: "input_json_delta", partial_json: '{"value":"abc"}' },
          },
          { type: "content_block_stop", index: 0 },
          {
            type: "message_delta",
            delta: { stop_reason: "tool_use", stop_sequence: null },
            usage: { output_tokens: 6 },
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
            delta: { type: "text_delta", text: "Done." },
          },
          { type: "content_block_stop", index: 0 },
          {
            type: "message_delta",
            delta: { stop_reason: "end_turn", stop_sequence: null },
            usage: { output_tokens: 3 },
          },
          { type: "message_stop" },
        ]),
      );

    const toolExecute = vi
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
      execute: toolExecute,
    });

    const messages: Message[] = [{ role: "user", content: [{ type: "text", text: "Use tool" }] }];
    const write = vi.fn<(text: string) => void>();

    await runAgentLoop({
      messages,
      toolRegistry: registry,
      model: "claude-sonnet-4-20250514",
      apiKey: "test-key",
      write,
    });

    expect(streamMock).toHaveBeenCalledTimes(2);
    expect(toolExecute).toHaveBeenCalledWith({ value: "abc" });

    expect(messages).toHaveLength(4);
    expect(messages[1]).toEqual({
      role: "assistant",
      content: [{ type: "tool_use", id: "tool_1", name: "test_tool", input: { value: "abc" } }],
    });
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
    expect(messages[3]).toEqual({ role: "assistant", content: [{ type: "text", text: "Done." }] });
  });

  it("returns tool error result for unknown tool name", async () => {
    const streamMock = vi.mocked(streamMessage);
    streamMock
      .mockImplementationOnce(() =>
        createStreamFromEvents([
          {
            type: "content_block_start",
            index: 0,
            content_block: { type: "tool_use", id: "missing_1", name: "nonexistent_tool", input: {} },
          },
          {
            type: "content_block_delta",
            index: 0,
            delta: { type: "input_json_delta", partial_json: "{}" },
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
            delta: { type: "text_delta", text: "Handled." },
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

    const messages: Message[] = [{ role: "user", content: [{ type: "text", text: "Run missing tool" }] }];

    await runAgentLoop({
      messages,
      toolRegistry: createToolRegistry(),
      model: "claude-sonnet-4-20250514",
      apiKey: "test-key",
      write: vi.fn(),
    });

    const toolResultMessage = messages[2];
    expect(toolResultMessage.role).toBe("user");

    const [toolResult] = toolResultMessage.content;
    expect(toolResult).toEqual({
      type: "tool_result",
      tool_use_id: "missing_1",
      content: 'Error: Tool "nonexistent_tool" not found.',
      is_error: true,
    });
  });

  it("stops at iteration limit and writes warning", async () => {
    const streamMock = vi.mocked(streamMessage);
    streamMock.mockImplementation(() =>
      createStreamFromEvents([
        {
          type: "content_block_start",
          index: 0,
          content_block: { type: "tool_use", id: "loop_tool", name: "test_tool", input: {} },
        },
        {
          type: "content_block_delta",
          index: 0,
          delta: { type: "input_json_delta", partial_json: "{}" },
        },
        { type: "content_block_stop", index: 0 },
        {
          type: "message_delta",
          delta: { stop_reason: "tool_use", stop_sequence: null },
          usage: { output_tokens: 1 },
        },
        { type: "message_stop" },
      ]),
    );

    const registry = createToolRegistry();
    registry.register({
      definition: {
        name: "test_tool",
        description: "Loop tool",
        input_schema: { type: "object", properties: {} },
      },
      permission: "allow",
      execute: vi.fn().mockResolvedValue({ content: "ok" }),
    });

    const write = vi.fn<(text: string) => void>();
    const messages: Message[] = [{ role: "user", content: [{ type: "text", text: "loop" }] }];

    await runAgentLoop({
      messages,
      toolRegistry: registry,
      model: "claude-sonnet-4-20250514",
      apiKey: "test-key",
      write,
    });

    expect(streamMock).toHaveBeenCalledTimes(10);
    expect(write).toHaveBeenCalledWith("\n⚠ Warning: Maximum tool-calling iterations reached.\n");
  });

  it("executes allow-permission tool without calling promptForApproval", async () => {
    const streamMock = vi.mocked(streamMessage);
    streamMock
      .mockImplementationOnce(() =>
        createStreamFromEvents([
          {
            type: "content_block_start",
            index: 0,
            content_block: { type: "tool_use", id: "t1", name: "allowed_tool", input: {} },
          },
          {
            type: "content_block_delta",
            index: 0,
            delta: { type: "input_json_delta", partial_json: "{}" },
          },
          { type: "content_block_stop", index: 0 },
          {
            type: "message_delta",
            delta: { stop_reason: "tool_use", stop_sequence: null },
            usage: { output_tokens: 1 },
          },
          { type: "message_stop" },
        ]),
      )
      .mockImplementationOnce(() =>
        createStreamFromEvents([
          { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } },
          { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "ok" } },
          { type: "content_block_stop", index: 0 },
          { type: "message_delta", delta: { stop_reason: "end_turn", stop_sequence: null }, usage: { output_tokens: 1 } },
          { type: "message_stop" },
        ]),
      );

    const toolExecute = vi.fn().mockResolvedValue({ content: "result" });
    const promptForApproval = vi.fn();

    const registry = createToolRegistry();
    registry.register({
      definition: { name: "allowed_tool", description: "Allowed", input_schema: { type: "object", properties: {} } },
      permission: "allow",
      execute: toolExecute,
    });

    const messages: Message[] = [{ role: "user", content: [{ type: "text", text: "go" }] }];

    await runAgentLoop({
      messages,
      toolRegistry: registry,
      model: "claude-sonnet-4-20250514",
      apiKey: "test-key",
      write: vi.fn(),
      promptForApproval,
    });

    expect(toolExecute).toHaveBeenCalled();
    expect(promptForApproval).not.toHaveBeenCalled();
  });

  it("denies tool with deny permission without executing or prompting", async () => {
    const streamMock = vi.mocked(streamMessage);
    streamMock
      .mockImplementationOnce(() =>
        createStreamFromEvents([
          {
            type: "content_block_start",
            index: 0,
            content_block: { type: "tool_use", id: "t1", name: "denied_tool", input: {} },
          },
          {
            type: "content_block_delta",
            index: 0,
            delta: { type: "input_json_delta", partial_json: "{}" },
          },
          { type: "content_block_stop", index: 0 },
          {
            type: "message_delta",
            delta: { stop_reason: "tool_use", stop_sequence: null },
            usage: { output_tokens: 1 },
          },
          { type: "message_stop" },
        ]),
      )
      .mockImplementationOnce(() =>
        createStreamFromEvents([
          { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } },
          { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "ok" } },
          { type: "content_block_stop", index: 0 },
          { type: "message_delta", delta: { stop_reason: "end_turn", stop_sequence: null }, usage: { output_tokens: 1 } },
          { type: "message_stop" },
        ]),
      );

    const toolExecute = vi.fn().mockResolvedValue({ content: "result" });
    const promptForApproval = vi.fn();

    const registry = createToolRegistry();
    registry.register({
      definition: { name: "denied_tool", description: "Denied", input_schema: { type: "object", properties: {} } },
      permission: "deny",
      execute: toolExecute,
    });

    const messages: Message[] = [{ role: "user", content: [{ type: "text", text: "go" }] }];

    await runAgentLoop({
      messages,
      toolRegistry: registry,
      model: "claude-sonnet-4-20250514",
      apiKey: "test-key",
      write: vi.fn(),
      promptForApproval,
    });

    expect(toolExecute).not.toHaveBeenCalled();
    expect(promptForApproval).not.toHaveBeenCalled();

    const toolResultMessage = messages[2];
    const [toolResult] = toolResultMessage.content;
    expect(toolResult).toMatchObject({
      type: "tool_result",
      is_error: true,
      content: expect.stringContaining("denied_tool"),
    });
  });

  it("calls promptForApproval for prompt-permission tool and executes on approval", async () => {
    const streamMock = vi.mocked(streamMessage);
    streamMock
      .mockImplementationOnce(() =>
        createStreamFromEvents([
          {
            type: "content_block_start",
            index: 0,
            content_block: { type: "tool_use", id: "t1", name: "prompt_tool", input: {} },
          },
          {
            type: "content_block_delta",
            index: 0,
            delta: { type: "input_json_delta", partial_json: '{"cmd":"test"}' },
          },
          { type: "content_block_stop", index: 0 },
          {
            type: "message_delta",
            delta: { stop_reason: "tool_use", stop_sequence: null },
            usage: { output_tokens: 1 },
          },
          { type: "message_stop" },
        ]),
      )
      .mockImplementationOnce(() =>
        createStreamFromEvents([
          { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } },
          { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "ok" } },
          { type: "content_block_stop", index: 0 },
          { type: "message_delta", delta: { stop_reason: "end_turn", stop_sequence: null }, usage: { output_tokens: 1 } },
          { type: "message_stop" },
        ]),
      );

    const toolExecute = vi.fn().mockResolvedValue({ content: "executed" });
    const promptForApproval = vi.fn().mockResolvedValue(true);

    const registry = createToolRegistry();
    registry.register({
      definition: { name: "prompt_tool", description: "Prompt", input_schema: { type: "object", properties: {} } },
      permission: "prompt",
      execute: toolExecute,
    });

    const messages: Message[] = [{ role: "user", content: [{ type: "text", text: "go" }] }];

    await runAgentLoop({
      messages,
      toolRegistry: registry,
      model: "claude-sonnet-4-20250514",
      apiKey: "test-key",
      write: vi.fn(),
      promptForApproval,
    });

    expect(promptForApproval).toHaveBeenCalledWith("prompt_tool", { cmd: "test" });
    expect(toolExecute).toHaveBeenCalledWith({ cmd: "test" });
  });

  it("denies prompt-permission tool when user declines", async () => {
    const streamMock = vi.mocked(streamMessage);
    streamMock
      .mockImplementationOnce(() =>
        createStreamFromEvents([
          {
            type: "content_block_start",
            index: 0,
            content_block: { type: "tool_use", id: "t1", name: "prompt_tool", input: {} },
          },
          {
            type: "content_block_delta",
            index: 0,
            delta: { type: "input_json_delta", partial_json: "{}" },
          },
          { type: "content_block_stop", index: 0 },
          {
            type: "message_delta",
            delta: { stop_reason: "tool_use", stop_sequence: null },
            usage: { output_tokens: 1 },
          },
          { type: "message_stop" },
        ]),
      )
      .mockImplementationOnce(() =>
        createStreamFromEvents([
          { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } },
          { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "ok" } },
          { type: "content_block_stop", index: 0 },
          { type: "message_delta", delta: { stop_reason: "end_turn", stop_sequence: null }, usage: { output_tokens: 1 } },
          { type: "message_stop" },
        ]),
      );

    const toolExecute = vi.fn().mockResolvedValue({ content: "result" });
    const promptForApproval = vi.fn().mockResolvedValue(false);

    const registry = createToolRegistry();
    registry.register({
      definition: { name: "prompt_tool", description: "Prompt", input_schema: { type: "object", properties: {} } },
      permission: "prompt",
      execute: toolExecute,
    });

    const messages: Message[] = [{ role: "user", content: [{ type: "text", text: "go" }] }];

    await runAgentLoop({
      messages,
      toolRegistry: registry,
      model: "claude-sonnet-4-20250514",
      apiKey: "test-key",
      write: vi.fn(),
      promptForApproval,
    });

    expect(promptForApproval).toHaveBeenCalled();
    expect(toolExecute).not.toHaveBeenCalled();

    const toolResultMessage = messages[2];
    const [toolResult] = toolResultMessage.content;
    expect(toolResult).toMatchObject({
      type: "tool_result",
      is_error: true,
      content: expect.stringContaining("prompt_tool"),
    });
  });

  it("denies prompt-permission tool when no promptForApproval callback provided", async () => {
    const streamMock = vi.mocked(streamMessage);
    streamMock
      .mockImplementationOnce(() =>
        createStreamFromEvents([
          {
            type: "content_block_start",
            index: 0,
            content_block: { type: "tool_use", id: "t1", name: "prompt_tool", input: {} },
          },
          {
            type: "content_block_delta",
            index: 0,
            delta: { type: "input_json_delta", partial_json: "{}" },
          },
          { type: "content_block_stop", index: 0 },
          {
            type: "message_delta",
            delta: { stop_reason: "tool_use", stop_sequence: null },
            usage: { output_tokens: 1 },
          },
          { type: "message_stop" },
        ]),
      )
      .mockImplementationOnce(() =>
        createStreamFromEvents([
          { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } },
          { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "ok" } },
          { type: "content_block_stop", index: 0 },
          { type: "message_delta", delta: { stop_reason: "end_turn", stop_sequence: null }, usage: { output_tokens: 1 } },
          { type: "message_stop" },
        ]),
      );

    const toolExecute = vi.fn().mockResolvedValue({ content: "result" });

    const registry = createToolRegistry();
    registry.register({
      definition: { name: "prompt_tool", description: "Prompt", input_schema: { type: "object", properties: {} } },
      permission: "prompt",
      execute: toolExecute,
    });

    const messages: Message[] = [{ role: "user", content: [{ type: "text", text: "go" }] }];

    await runAgentLoop({
      messages,
      toolRegistry: registry,
      model: "claude-sonnet-4-20250514",
      apiKey: "test-key",
      write: vi.fn(),
      // no promptForApproval
    });

    expect(toolExecute).not.toHaveBeenCalled();

    const toolResultMessage = messages[2];
    const [toolResult] = toolResultMessage.content;
    expect(toolResult).toMatchObject({
      type: "tool_result",
      is_error: true,
      content: expect.stringContaining("denied"),
    });
  });
});

describe("token tracking", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("tracks token usage when tokenTracker is provided", async () => {
    const streamMock = vi.mocked(streamMessage);
    streamMock.mockImplementation(async function* () {
      yield {
        type: "message_start",
        message: {
          id: "msg_1",
          type: "message",
          role: "assistant",
          content: [],
          model: "claude-sonnet-4-20250514",
          stop_reason: null,
          stop_sequence: null,
          usage: { input_tokens: 100, output_tokens: 0 },
        },
      };
      yield {
        type: "content_block_start",
        index: 0,
        content_block: { type: "text", text: "" },
      };
      yield {
        type: "content_block_delta",
        index: 0,
        delta: { type: "text_delta", text: "Hello" },
      };
      yield { type: "content_block_stop", index: 0 };
      yield {
        type: "message_delta",
        delta: { stop_reason: "end_turn", stop_sequence: null },
        usage: { output_tokens: 50 },
      };
      yield { type: "message_stop" };
      return { usage: { inputTokens: 100, outputTokens: 50 } };
    });

    const { TokenTracker } = await import("../context/tracker.js");
    const tracker = new TokenTracker({ contextWindowLimit: 100_000, compressionThreshold: 0.8 });

    const messages: Message[] = [{ role: "user", content: [{ type: "text", text: "Hi" }] }];
    const write = vi.fn<(text: string) => void>();

    await runAgentLoop({
      messages,
      toolRegistry: createToolRegistry(),
      model: "claude-sonnet-4-20250514",
      apiKey: "test-key",
      write,
      tokenTracker: tracker,
    });

    const totals = tracker.getTotals();
    expect(totals.inputTokens).toBe(100);
    expect(totals.outputTokens).toBe(50);
    expect(totals.combined).toBe(150);
  });

  it("tracks message count", async () => {
    const streamMock = vi.mocked(streamMessage);
    streamMock.mockImplementation(async function* () {
      yield { type: "message_start", message: { id: "msg_1", type: "message", role: "assistant", content: [], model: "claude-sonnet-4-20250514", stop_reason: null, stop_sequence: null, usage: { input_tokens: 10, output_tokens: 0 } } };
      yield { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } };
      yield { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "Hi" } };
      yield { type: "content_block_stop", index: 0 };
      yield { type: "message_delta", delta: { stop_reason: "end_turn", stop_sequence: null }, usage: { output_tokens: 5 } };
      yield { type: "message_stop" };
      return { usage: { inputTokens: 10, outputTokens: 5 } };
    });

    const { TokenTracker } = await import("../context/tracker.js");
    const tracker = new TokenTracker();

    const messages: Message[] = [{ role: "user", content: [{ type: "text", text: "Hi" }] }];

    await runAgentLoop({
      messages,
      toolRegistry: createToolRegistry(),
      model: "claude-sonnet-4-20250514",
      apiKey: "test-key",
      write: vi.fn(),
      tokenTracker: tracker,
    });

    expect(tracker.getMessageCount()).toBe(1);
  });

  it("accumulates tokens across multiple turns", async () => {
    const streamMock = vi.mocked(streamMessage);
    streamMock
      .mockImplementationOnce(async function* () {
        yield { type: "message_start", message: { id: "msg_1", type: "message", role: "assistant", content: [], model: "claude-sonnet-4-20250514", stop_reason: null, stop_sequence: null, usage: { input_tokens: 100, output_tokens: 0 } } };
        yield { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } };
        yield { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "First" } };
        yield { type: "content_block_stop", index: 0 };
        yield { type: "message_delta", delta: { stop_reason: "end_turn", stop_sequence: null }, usage: { output_tokens: 50 } };
        yield { type: "message_stop" };
        return { usage: { inputTokens: 100, outputTokens: 50 } };
      })
      .mockImplementationOnce(async function* () {
        yield { type: "message_start", message: { id: "msg_2", type: "message", role: "assistant", content: [], model: "claude-sonnet-4-20250514", stop_reason: null, stop_sequence: null, usage: { input_tokens: 200, output_tokens: 0 } } };
        yield { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } };
        yield { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "Second" } };
        yield { type: "content_block_stop", index: 0 };
        yield { type: "message_delta", delta: { stop_reason: "end_turn", stop_sequence: null }, usage: { output_tokens: 75 } };
        yield { type: "message_stop" };
        return { usage: { inputTokens: 200, outputTokens: 75 } };
      });

    const { TokenTracker } = await import("../context/tracker.js");
    const tracker = new TokenTracker();

    const messages: Message[] = [{ role: "user", content: [{ type: "text", text: "Hi" }] }];

    await runAgentLoop({
      messages,
      toolRegistry: createToolRegistry(),
      model: "claude-sonnet-4-20250514",
      apiKey: "test-key",
      write: vi.fn(),
      tokenTracker: tracker,
    });

    messages.push({ role: "user", content: [{ type: "text", text: "Again" }] });

    await runAgentLoop({
      messages,
      toolRegistry: createToolRegistry(),
      model: "claude-sonnet-4-20250514",
      apiKey: "test-key",
      write: vi.fn(),
      tokenTracker: tracker,
    });

    const totals = tracker.getTotals();
    expect(totals.inputTokens).toBe(300);
    expect(totals.outputTokens).toBe(125);
  });
});
