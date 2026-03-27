import type { Message } from "../api/anthropic.js";
import type { TokenTrackerOptions, TokenUsage, TokenStats } from "./types.js";

const DEFAULT_CONTEXT_WINDOW_LIMIT = 200_000;
const DEFAULT_COMPRESSION_THRESHOLD = 0.8;

export class TokenTracker {
  private totalInputTokens = 0;
  private totalOutputTokens = 0;
  private readonly contextWindowLimit: number;
  private readonly compressionThreshold: number;
  private messageCount = 0;

  constructor(options?: Partial<TokenTrackerOptions>) {
    this.contextWindowLimit =
      options?.contextWindowLimit ?? DEFAULT_CONTEXT_WINDOW_LIMIT;
    this.compressionThreshold =
      options?.compressionThreshold ?? DEFAULT_COMPRESSION_THRESHOLD;
  }

  addUsage(usage: TokenUsage): void {
    this.totalInputTokens += usage.inputTokens;
    this.totalOutputTokens += usage.outputTokens;
  }

  addMessage(): void {
    this.messageCount += 1;
  }

  getTotals(): { inputTokens: number; outputTokens: number; combined: number } {
    return {
      inputTokens: this.totalInputTokens,
      outputTokens: this.totalOutputTokens,
      combined: this.totalInputTokens + this.totalOutputTokens,
    };
  }

  getUsagePercentage(): number {
    const combined = this.totalInputTokens + this.totalOutputTokens;
    return (combined / this.contextWindowLimit) * 100;
  }

  needsCompression(): boolean {
    const combined = this.totalInputTokens + this.totalOutputTokens;
    const threshold = this.contextWindowLimit * this.compressionThreshold;
    return combined >= threshold;
  }

  getMessageCount(): number {
    return this.messageCount;
  }

  getStats(): TokenStats {
    const combined = this.totalInputTokens + this.totalOutputTokens;
    return {
      totalInputTokens: this.totalInputTokens,
      totalOutputTokens: this.totalOutputTokens,
      combinedTokens: combined,
      usagePercentage: (combined / this.contextWindowLimit) * 100,
      messageCount: this.messageCount,
      contextWindowLimit: this.contextWindowLimit,
    };
  }

  resetAfterCompression(messagesAfter: Message[]): void {
    this.messageCount = messagesAfter.length;
  }
}
