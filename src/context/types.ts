import type { Message } from "../api/anthropic.js";

export type TokenUsage = {
  inputTokens: number;
  outputTokens: number;
};

export type TokenTrackerOptions = {
  contextWindowLimit: number;
  compressionThreshold: number;
};

export type CompressionResult = {
  success: boolean;
  messagesBefore: number;
  messagesAfter: number;
  error?: string;
};

export type TokenStats = {
  totalInputTokens: number;
  totalOutputTokens: number;
  combinedTokens: number;
  usagePercentage: number;
  messageCount: number;
  contextWindowLimit: number;
};

export type CompressionOptions = {
  messages: Message[];
  model: string;
  apiKey: string;
  preserveTurns: number;
  timeoutMs: number;
};
