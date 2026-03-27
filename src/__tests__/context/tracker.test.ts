import { describe, expect, it } from "vitest";

import { TokenTracker } from "../../context/tracker.js";

describe("TokenTracker", () => {
  describe("addUsage", () => {
    it("accumulates input and output tokens", () => {
      const tracker = new TokenTracker();

      tracker.addUsage({ inputTokens: 100, outputTokens: 50 });
      tracker.addUsage({ inputTokens: 200, outputTokens: 75 });

      const totals = tracker.getTotals();
      expect(totals.inputTokens).toBe(300);
      expect(totals.outputTokens).toBe(125);
      expect(totals.combined).toBe(425);
    });

    it("starts at zero tokens", () => {
      const tracker = new TokenTracker();

      const totals = tracker.getTotals();
      expect(totals.inputTokens).toBe(0);
      expect(totals.outputTokens).toBe(0);
      expect(totals.combined).toBe(0);
    });
  });

  describe("getUsagePercentage", () => {
    it("calculates percentage of context window used", () => {
      const tracker = new TokenTracker({ contextWindowLimit: 100_000, compressionThreshold: 0.8 });

      tracker.addUsage({ inputTokens: 25_000, outputTokens: 25_000 });

      expect(tracker.getUsagePercentage()).toBe(50);
    });

    it("returns 0 when no tokens used", () => {
      const tracker = new TokenTracker();

      expect(tracker.getUsagePercentage()).toBe(0);
    });

    it("uses default 200K context window", () => {
      const tracker = new TokenTracker();

      tracker.addUsage({ inputTokens: 100_000, outputTokens: 0 });

      expect(tracker.getUsagePercentage()).toBe(50);
    });
  });

  describe("needsCompression", () => {
    it("returns true when at 80% threshold", () => {
      const tracker = new TokenTracker({ contextWindowLimit: 100_000, compressionThreshold: 0.8 });

      tracker.addUsage({ inputTokens: 80_000, outputTokens: 0 });

      expect(tracker.needsCompression()).toBe(true);
    });

    it("returns true when above threshold", () => {
      const tracker = new TokenTracker({ contextWindowLimit: 100_000, compressionThreshold: 0.8 });

      tracker.addUsage({ inputTokens: 90_000, outputTokens: 0 });

      expect(tracker.needsCompression()).toBe(true);
    });

    it("returns false when below threshold", () => {
      const tracker = new TokenTracker({ contextWindowLimit: 100_000, compressionThreshold: 0.8 });

      tracker.addUsage({ inputTokens: 79_999, outputTokens: 0 });

      expect(tracker.needsCompression()).toBe(false);
    });

    it("uses default 80% threshold with 200K limit", () => {
      const tracker = new TokenTracker();

      tracker.addUsage({ inputTokens: 159_999, outputTokens: 0 });

      expect(tracker.needsCompression()).toBe(false);

      tracker.addUsage({ inputTokens: 1, outputTokens: 0 });

      expect(tracker.needsCompression()).toBe(true);
    });
  });

  describe("getMessageCount", () => {
    it("tracks message count", () => {
      const tracker = new TokenTracker();

      tracker.addMessage();
      tracker.addMessage();
      tracker.addMessage();

      expect(tracker.getMessageCount()).toBe(3);
    });

    it("starts at zero", () => {
      const tracker = new TokenTracker();

      expect(tracker.getMessageCount()).toBe(0);
    });
  });

  describe("getStats", () => {
    it("returns complete token statistics", () => {
      const tracker = new TokenTracker({ contextWindowLimit: 100_000, compressionThreshold: 0.8 });

      tracker.addUsage({ inputTokens: 30_000, outputTokens: 20_000 });
      tracker.addMessage();
      tracker.addMessage();

      const stats = tracker.getStats();

      expect(stats).toEqual({
        totalInputTokens: 30_000,
        totalOutputTokens: 20_000,
        combinedTokens: 50_000,
        usagePercentage: 50,
        messageCount: 2,
        contextWindowLimit: 100_000,
      });
    });
  });

  describe("resetAfterCompression", () => {
    it("updates message count after compression", () => {
      const tracker = new TokenTracker();
      tracker.addMessage();
      tracker.addMessage();
      tracker.addMessage();

      expect(tracker.getMessageCount()).toBe(3);

      tracker.resetAfterCompression([{ role: "user", content: [{ type: "text", text: "summary" }] }]);

      expect(tracker.getMessageCount()).toBe(1);
    });
  });
});
