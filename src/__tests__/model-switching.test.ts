import { describe, expect, it, vi } from "vitest";

import { handleSlashCommand } from "../repl/commands.js";
import { TokenTracker } from "../context/tracker.js";

function createCommandOptions(overrides: {
  getModel?: () => string;
  setModel?: (modelId: string) => void;
} = {}) {
  return {
    projectRoot: "/tmp/project",
    tracker: new TokenTracker(),
    writeLine: vi.fn(),
    remember: vi.fn(),
    recall: vi.fn(),
    forget: vi.fn(),
    getModel: overrides.getModel ?? (() => "claude-sonnet-4-20250514"),
    setModel: overrides.setModel ?? vi.fn(),
    getPlanMode: () => false,
    setPlanMode: vi.fn(),
  };
}

describe("model switching", () => {
  describe("/model command", () => {
    it("shows current model when called without arguments", async () => {
      const options = createCommandOptions({
        getModel: () => "claude-sonnet-4-20250514",
      });

      const handled = await handleSlashCommand("/model", options);

      expect(handled).toBe(true);
      expect(options.writeLine).toHaveBeenCalledWith(
        "Current model: claude-sonnet-4-20250514",
      );
    });

    it("switches model when called with an argument", async () => {
      const setModel = vi.fn();
      const options = createCommandOptions({
        getModel: () => "claude-sonnet-4-20250514",
        setModel,
      });

      const handled = await handleSlashCommand("/model claude-opus-4-20250514", options);

      expect(handled).toBe(true);
      expect(setModel).toHaveBeenCalledWith("claude-opus-4-20250514");
      expect(options.writeLine).toHaveBeenCalledWith(
        "Model switched: claude-sonnet-4-20250514 → claude-opus-4-20250514",
      );
    });

    it("is case-insensitive for the command prefix", async () => {
      const options = createCommandOptions();

      const handled = await handleSlashCommand("/MODEL", options);

      expect(handled).toBe(true);
      expect(options.writeLine).toHaveBeenCalledWith(
        expect.stringContaining("Current model:"),
      );
    });

    it("preserves model ID casing in the argument", async () => {
      const setModel = vi.fn();
      const options = createCommandOptions({
        getModel: () => "old-model",
        setModel,
      });

      await handleSlashCommand("/model Claude-Sonnet-4", options);

      expect(setModel).toHaveBeenCalledWith("Claude-Sonnet-4");
    });
  });

  describe("/status includes model", () => {
    it("shows current model in status output", async () => {
      const options = createCommandOptions({
        getModel: () => "claude-haiku-3-20250307",
      });

      await handleSlashCommand("/status", options);

      expect(options.writeLine).toHaveBeenCalledWith(
        expect.stringContaining("Model: claude-haiku-3-20250307"),
      );
    });
  });
});
