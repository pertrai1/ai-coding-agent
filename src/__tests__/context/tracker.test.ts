import { describe, expect, it } from "vitest";

import { TokenTracker } from "../../context/tracker.js";

describe("TokenTracker", () => {
  it("accumulates session totals", () => {
    const tracker = new TokenTracker();

    tracker.addUsage({ inputTokens: 100, outputTokens: 50 });
    tracker.addUsage({ inputTokens: 200, outputTokens: 75 });

    expect(tracker.getTotals()).toEqual({
      inputTokens: 300,
      outputTokens: 125,
      combined: 425,
    });
  });

  it("tracks current context independently from session totals", () => {
    const tracker = new TokenTracker({ contextWindowLimit: 100_000, compressionThreshold: 0.8 });

    tracker.addUsage({ inputTokens: 10_000, outputTokens: 2_000 });
    tracker.setCurrentContextUsage({ inputTokens: 10_000, outputTokens: 2_000 });

    tracker.addUsage({ inputTokens: 12_000, outputTokens: 3_000 });
    tracker.setCurrentContextUsage({ inputTokens: 12_000, outputTokens: 3_000 });

    expect(tracker.getTotals()).toEqual({
      inputTokens: 22_000,
      outputTokens: 5_000,
      combined: 27_000,
    });
    expect(tracker.getCurrentContextTotals()).toEqual({
      inputTokens: 12_000,
      outputTokens: 3_000,
      combined: 15_000,
    });
  });

  it("uses current context for compression threshold", () => {
    const tracker = new TokenTracker({ contextWindowLimit: 100_000, compressionThreshold: 0.8 });

    tracker.addUsage({ inputTokens: 90_000, outputTokens: 0 });
    tracker.setCurrentContextUsage({ inputTokens: 79_000, outputTokens: 0 });

    expect(tracker.needsCompression()).toBe(false);

    tracker.setCurrentContextUsage({ inputTokens: 80_000, outputTokens: 0 });

    expect(tracker.needsCompression()).toBe(true);
  });

  it("resets current context after compression but preserves session totals", () => {
    const tracker = new TokenTracker({ contextWindowLimit: 100_000, compressionThreshold: 0.8 });

    tracker.addUsage({ inputTokens: 85_000, outputTokens: 5_000 });
    tracker.setCurrentContextUsage({ inputTokens: 85_000, outputTokens: 5_000 });
    tracker.addMessage();
    tracker.addMessage();
    tracker.addMessage();

    expect(tracker.needsCompression()).toBe(true);

    tracker.resetAfterCompression([{ role: "user", content: [{ type: "text", text: "summary" }] }]);

    expect(tracker.needsCompression()).toBe(false);
    expect(tracker.getCurrentContextTotals()).toEqual({
      inputTokens: 0,
      outputTokens: 0,
      combined: 0,
    });
    expect(tracker.getTotals()).toEqual({
      inputTokens: 85_000,
      outputTokens: 5_000,
      combined: 90_000,
    });
    expect(tracker.getMessageCount()).toBe(1);
  });

  it("returns detailed stats for status command", () => {
    const tracker = new TokenTracker({ contextWindowLimit: 100_000, compressionThreshold: 0.8 });

    tracker.addUsage({ inputTokens: 30_000, outputTokens: 8_000 });
    tracker.addUsage({ inputTokens: 20_000, outputTokens: 2_000 });
    tracker.setCurrentContextUsage({ inputTokens: 20_000, outputTokens: 2_000 });
    tracker.addMessage();
    tracker.addMessage();

    expect(tracker.getStats()).toEqual({
      sessionInputTokens: 50_000,
      sessionOutputTokens: 10_000,
      sessionCombinedTokens: 60_000,
      currentContextInputTokens: 20_000,
      currentContextOutputTokens: 2_000,
      currentContextCombinedTokens: 22_000,
      usagePercentage: 22,
      messageCount: 2,
      contextWindowLimit: 100_000,
    });
  });
});
