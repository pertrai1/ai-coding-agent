import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { streamMessage } from "../api/anthropic.js";
import { isEmptyInput, isExitCommand, startRepl } from "../repl.js";
import { createInterface } from "node:readline/promises";

vi.mock("../api/anthropic.js", async () => {
  const actual = await vi.importActual<typeof import("../api/anthropic.js")>(
    "../api/anthropic.js",
  );

  return {
    ...actual,
    streamMessage: vi.fn(),
  };
});

vi.mock("node:readline/promises", () => ({
  createInterface: vi.fn(),
}));

describe("repl", () => {
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

  describe("isExitCommand", () => {
    it.each([
      ["exit", true],
      ["quit", true],
      ["EXIT", true],
      ["Quit", true],
      ["  exit  ", true],
      ["hello", false],
      ["exiting", false],
      ["", false],
    ])("returns %s -> %s", (input, expected) => {
      expect(isExitCommand(input)).toBe(expected);
    });
  });

  describe("isEmptyInput", () => {
    it.each([
      ["", true],
      ["   ", true],
      ["\t", true],
      ["\n", true],
      ["hello", false],
      [" hi ", false],
    ])("returns %j -> %s", (input, expected) => {
      expect(isEmptyInput(input)).toBe(expected);
    });
  });

  describe("conversation history", () => {
    it("appends user message before API call", async () => {
      const question = vi.fn<(prompt: string) => Promise<string>>()
        .mockResolvedValueOnce("hello")
        .mockResolvedValueOnce("exit");
      const close = vi.fn();

      vi.mocked(createInterface).mockReturnValue({
        question,
        close,
      } as never);

      const streamMock = vi.mocked(streamMessage);
      streamMock.mockImplementation(async function* (options) {
        expect(options.messages).toEqual([{ role: "user", content: "hello" }]);

        yield {
          type: "content_block_delta",
          index: 0,
          delta: { type: "text_delta", text: "Hi" },
        };

        return {
          usage: { inputTokens: 10, outputTokens: 5 },
        };
      });

      await startRepl("test-key");

      expect(streamMock).toHaveBeenCalledTimes(1);
      expect(close).toHaveBeenCalled();
    });

    it("appends assistant message after successful stream", async () => {
      const question = vi.fn<(prompt: string) => Promise<string>>()
        .mockResolvedValueOnce("hello")
        .mockResolvedValueOnce("follow up")
        .mockResolvedValueOnce("exit");

      vi.mocked(createInterface).mockReturnValue({
        question,
        close: vi.fn(),
      } as never);

      const streamMock = vi.mocked(streamMessage);
      let callCount = 0;

      streamMock.mockImplementation(async function* (options) {
        callCount += 1;

        if (callCount === 1) {
          expect(options.messages).toEqual([{ role: "user", content: "hello" }]);
          yield {
            type: "content_block_delta",
            index: 0,
            delta: { type: "text_delta", text: "Hi there" },
          };
        } else {
          expect(options.messages).toEqual([
            { role: "user", content: "hello" },
            { role: "assistant", content: "Hi there" },
            { role: "user", content: "follow up" },
          ]);
          yield {
            type: "content_block_delta",
            index: 0,
            delta: { type: "text_delta", text: "Sure" },
          };
        }

        return {
          usage: { inputTokens: 10, outputTokens: 5 },
        };
      });

      await startRepl("test-key");

      expect(streamMock).toHaveBeenCalledTimes(2);
    });

    it("does not append assistant message on stream error", async () => {
      const question = vi.fn<(prompt: string) => Promise<string>>()
        .mockResolvedValueOnce("hello")
        .mockResolvedValueOnce("retry")
        .mockResolvedValueOnce("exit");

      vi.mocked(createInterface).mockReturnValue({
        question,
        close: vi.fn(),
      } as never);

      const streamMock = vi.mocked(streamMessage);
      let callCount = 0;

      streamMock.mockImplementation(async function* (options) {
        callCount += 1;

        if (callCount === 1) {
          throw new Error("stream failed");
        }

        expect(options.messages).toEqual([
          { role: "user", content: "hello" },
          { role: "user", content: "retry" },
        ]);

        yield {
          type: "content_block_delta",
          index: 0,
          delta: { type: "text_delta", text: "Ok" },
        };

        return {
          usage: { inputTokens: 10, outputTokens: 5 },
        };
      });

      await startRepl("test-key");

      expect(streamMock).toHaveBeenCalledTimes(2);
    });
  });
});
