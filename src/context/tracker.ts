import type { Message } from "../api/anthropic.js";
import type { TokenTrackerOptions, TokenUsage, TokenStats } from "./types.js";

const DEFAULT_CONTEXT_WINDOW_LIMIT = 200_000;
const DEFAULT_COMPRESSION_THRESHOLD = 0.8;

export class TokenTracker {
  private sessionInputTokens = 0;
  private sessionOutputTokens = 0;
  private currentContextInputTokens = 0;
  private currentContextOutputTokens = 0;
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
    this.sessionInputTokens += usage.inputTokens;
    this.sessionOutputTokens += usage.outputTokens;
  }

  setCurrentContextUsage(usage: TokenUsage): void {
    this.currentContextInputTokens = usage.inputTokens;
    this.currentContextOutputTokens = usage.outputTokens;
  }

  addMessage(): void {
    this.messageCount += 1;
  }

  hydrateSession(usage: TokenUsage, messageCount: number): void {
    this.sessionInputTokens = usage.inputTokens;
    this.sessionOutputTokens = usage.outputTokens;
    this.currentContextInputTokens = usage.inputTokens;
    this.currentContextOutputTokens = usage.outputTokens;
    this.messageCount = messageCount;
  }

  getTotals(): { inputTokens: number; outputTokens: number; combined: number } {
    return {
      inputTokens: this.sessionInputTokens,
      outputTokens: this.sessionOutputTokens,
      combined: this.sessionInputTokens + this.sessionOutputTokens,
    };
  }

  getCurrentContextTotals(): {
    inputTokens: number;
    outputTokens: number;
    combined: number;
  } {
    return {
      inputTokens: this.currentContextInputTokens,
      outputTokens: this.currentContextOutputTokens,
      combined:
        this.currentContextInputTokens + this.currentContextOutputTokens,
    };
  }

  getUsagePercentage(): number {
    const combined =
      this.currentContextInputTokens + this.currentContextOutputTokens;
    return (combined / this.contextWindowLimit) * 100;
  }

  needsCompression(): boolean {
    const combined =
      this.currentContextInputTokens + this.currentContextOutputTokens;
    const threshold = this.contextWindowLimit * this.compressionThreshold;
    return combined >= threshold;
  }

  getMessageCount(): number {
    return this.messageCount;
  }

  getStats(): TokenStats {
    const sessionCombined = this.sessionInputTokens + this.sessionOutputTokens;
    const currentContextCombined =
      this.currentContextInputTokens + this.currentContextOutputTokens;
    return {
      sessionInputTokens: this.sessionInputTokens,
      sessionOutputTokens: this.sessionOutputTokens,
      sessionCombinedTokens: sessionCombined,
      currentContextInputTokens: this.currentContextInputTokens,
      currentContextOutputTokens: this.currentContextOutputTokens,
      currentContextCombinedTokens: currentContextCombined,
      usagePercentage: (currentContextCombined / this.contextWindowLimit) * 100,
      messageCount: this.messageCount,
      contextWindowLimit: this.contextWindowLimit,
    };
  }

  resetAfterCompression(messagesAfter: Message[]): void {
    this.messageCount = messagesAfter.length;
    this.currentContextInputTokens = 0;
    this.currentContextOutputTokens = 0;
  }
}
