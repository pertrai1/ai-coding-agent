import { describe, expect, it, vi } from "vitest";

import { TokenTracker } from "../context/tracker.js";
import { handleSlashCommand } from "../repl/commands.js";

function createCommandOptions(overrides: {
  getPlanMode?: () => boolean;
  setPlanMode?: (active: boolean) => void;
} = {}) {
  return {
    projectRoot: "/tmp/project",
    tracker: new TokenTracker(),
    writeLine: vi.fn(),
    remember: vi.fn(),
    recall: vi.fn(),
    forget: vi.fn(),
    getModel: () => "claude-sonnet-4-20250514",
    setModel: vi.fn(),
    getPlanMode: overrides.getPlanMode ?? (() => false),
    setPlanMode: overrides.setPlanMode ?? vi.fn(),
  };
}

describe("plan mode commands", () => {
  describe("/plan command", () => {
    it("activates plan mode", async () => {
      const setPlanMode = vi.fn();
      const options = createCommandOptions({ setPlanMode });

      const handled = await handleSlashCommand("/plan", options);

      expect(handled).toBe(true);
      expect(setPlanMode).toHaveBeenCalledWith(true);
      expect(options.writeLine).toHaveBeenCalledWith(
        "Plan mode activated. Mutating tools are disabled. Produce a plan for the user to approve.",
      );
    });

    it("deactivates plan mode with /plan off", async () => {
      const setPlanMode = vi.fn();
      const options = createCommandOptions({ setPlanMode });

      const handled = await handleSlashCommand("/plan off", options);

      expect(handled).toBe(true);
      expect(setPlanMode).toHaveBeenCalledWith(false);
    });

    it("is case-insensitive", async () => {
      const setPlanMode = vi.fn();
      const options = createCommandOptions({ setPlanMode });

      const handled = await handleSlashCommand("/PLAN", options);

      expect(handled).toBe(true);
      expect(setPlanMode).toHaveBeenCalledWith(true);
    });
  });

  describe("/status includes plan mode", () => {
    it("shows plan mode when active", async () => {
      const options = createCommandOptions({
        getPlanMode: () => true,
      });

      await handleSlashCommand("/status", options);

      expect(options.writeLine).toHaveBeenCalledWith(
        expect.stringContaining("Mode: plan"),
      );
    });

    it("does not show plan mode when inactive", async () => {
      const options = createCommandOptions({
        getPlanMode: () => false,
      });

      await handleSlashCommand("/status", options);

      expect(options.writeLine).toHaveBeenCalledWith(
        expect.not.stringContaining("Mode: plan"),
      );
    });
  });

  it("returns false for unknown slash commands", async () => {
    const options = createCommandOptions();

    const handled = await handleSlashCommand("/not-a-command", options);

    expect(handled).toBe(false);
  });
});
