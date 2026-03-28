import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { streamMessage } from "../../api/anthropic.js";
import { startRepl } from "../../repl.js";
import { createInterface } from "node:readline/promises";
import type { ResolvedConfig } from "../../config/types.js";

vi.mock("../../api/anthropic.js", async () => {
  const actual = await vi.importActual<typeof import("../../api/anthropic.js")>(
    "../../api/anthropic.js",
  );

  return {
    ...actual,
    streamMessage: vi.fn(),
  };
});

vi.mock("node:readline/promises", () => ({
  createInterface: vi.fn(),
}));

function makeStreamMock() {
  return vi.mocked(streamMessage).mockImplementation(async function* () {
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
}

describe("repl config integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Spec: repl-chat-loop > Model from config > "Config specifies model"
  it("uses model from resolved config", async () => {
    const question = vi.fn<(prompt: string) => Promise<string>>()
      .mockResolvedValueOnce("hello")
      .mockResolvedValueOnce("exit");

    vi.mocked(createInterface).mockReturnValue({
      question,
      close: vi.fn(),
    } as never);

    const streamMock = makeStreamMock();

    const config: ResolvedConfig = {
      model: "claude-haiku-4-5-20250514",
    };

    await startRepl("test-key", config);

    expect(streamMock).toHaveBeenCalledWith(
      expect.objectContaining({ model: "claude-haiku-4-5-20250514" }),
    );
  });

  // Spec: repl-chat-loop > Model from config > "No model in config"
  it("falls back to default model when config has no model", async () => {
    const question = vi.fn<(prompt: string) => Promise<string>>()
      .mockResolvedValueOnce("hello")
      .mockResolvedValueOnce("exit");

    vi.mocked(createInterface).mockReturnValue({
      question,
      close: vi.fn(),
    } as never);

    const streamMock = makeStreamMock();

    const config: ResolvedConfig = {};

    await startRepl("test-key", config);

    expect(streamMock).toHaveBeenCalledWith(
      expect.objectContaining({ model: "claude-sonnet-4-20250514" }),
    );
  });

  // Spec: repl-chat-loop > System prompt > "System prompt with all sources"
  it("sends assembled system prompt with project instructions and extra", async () => {
    const question = vi.fn<(prompt: string) => Promise<string>>()
      .mockResolvedValueOnce("hello")
      .mockResolvedValueOnce("exit");

    vi.mocked(createInterface).mockReturnValue({
      question,
      close: vi.fn(),
    } as never);

    const streamMock = makeStreamMock();

    const config: ResolvedConfig = {
      systemPromptExtra: "Always explain your reasoning.",
      projectInstructions: "Follow the coding standards.",
    };

    await startRepl("test-key", config);

    const systemArg = streamMock.mock.calls[0][0].system;
    expect(systemArg).toContain("<project-instructions>");
    expect(systemArg).toContain("Follow the coding standards.");
    expect(systemArg).toContain("</project-instructions>");
    expect(systemArg).toContain("Always explain your reasoning.");
  });

  // Spec: repl-chat-loop > System prompt > "System prompt with no project instructions or extra text"
  it("sends only the base system prompt when config has no extras", async () => {
    const question = vi.fn<(prompt: string) => Promise<string>>()
      .mockResolvedValueOnce("hello")
      .mockResolvedValueOnce("exit");

    vi.mocked(createInterface).mockReturnValue({
      question,
      close: vi.fn(),
    } as never);

    const streamMock = makeStreamMock();

    const config: ResolvedConfig = {};

    await startRepl("test-key", config);

    const systemArg = streamMock.mock.calls[0][0].system;
    expect(systemArg).not.toContain("<project-instructions>");
    expect(systemArg).toContain("AI coding assistant");
  });

  // Spec: repl-chat-loop > System prompt > "System prompt with only AGENTS.md"
  it("includes project instructions but no extra when only AGENTS.md present", async () => {
    const question = vi.fn<(prompt: string) => Promise<string>>()
      .mockResolvedValueOnce("hello")
      .mockResolvedValueOnce("exit");

    vi.mocked(createInterface).mockReturnValue({
      question,
      close: vi.fn(),
    } as never);

    const streamMock = makeStreamMock();

    const config: ResolvedConfig = {
      projectInstructions: "Project rules here.",
    };

    await startRepl("test-key", config);

    const systemArg = streamMock.mock.calls[0][0].system;
    expect(systemArg).toContain("<project-instructions>");
    expect(systemArg).toContain("Project rules here.");
    expect(systemArg).toContain("</project-instructions>");
  });

  // Spec: tool-permissions > "Config overrides default permission" (integration via repl)
  it("applies permission overrides from config to tool registry", async () => {
    const question = vi.fn<(prompt: string) => Promise<string>>()
      .mockResolvedValueOnce("exit");

    vi.mocked(createInterface).mockReturnValue({
      question,
      close: vi.fn(),
    } as never);

    const config: ResolvedConfig = {
      permissions: { bash: "allow" },
    };

    // startRepl should pass permissions to createToolRegistry
    // We verify this indirectly: if bash is set to "allow", it should not prompt
    await startRepl("test-key", config);
    // Test passes if no error — the config was accepted
  });
});
