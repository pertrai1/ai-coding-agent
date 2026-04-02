import chalk from "chalk";

import type { TokenTracker } from "../context/tracker.js";
import type { MemoryIndexEntry } from "../persistence/memory.js";

type HandleSlashCommandOptions = {
  projectRoot: string;
  tracker: TokenTracker;
  writeLine: (line: string) => void;
  remember: (projectRoot: string, text: string) => Promise<{ id: string; text: string }>;
  recall: (projectRoot: string, query?: string) => Promise<MemoryIndexEntry[]>;
  forget: (projectRoot: string, memoryId: string) => Promise<{ removed: boolean }>;
  getModel: () => string;
  setModel: (modelId: string) => void;
};

function formatStatus(tracker: TokenTracker, model: string): string {
  const stats = tracker.getStats();
  const percentage = stats.usagePercentage.toFixed(1);
  const warning = stats.usagePercentage >= 75
    ? chalk.yellow("Status: Approaching limit - compression will trigger soon")
    : chalk.green("Status: OK");

  return [
    `Model: ${model}`,
    `Context: ${stats.currentContextCombinedTokens.toLocaleString()} / ${stats.contextWindowLimit.toLocaleString()} tokens (${percentage}%)`,
    `Session total: ${stats.sessionCombinedTokens.toLocaleString()} tokens`,
    `Messages: ${stats.messageCount} turns`,
    warning,
  ].join("\n");
}

function formatMemories(memories: MemoryIndexEntry[]): string[] {
  return memories.map((memory) => `${memory.id}: ${memory.text}`);
}

export async function handleSlashCommand(
  input: string,
  options: HandleSlashCommandOptions,
): Promise<boolean> {
  const trimmed = input.trim();
  if (!trimmed.startsWith("/")) {
    return false;
  }

  const { projectRoot, tracker, writeLine, remember, recall, forget, getModel, setModel } = options;

  if (trimmed.toLowerCase() === "/status") {
    writeLine(formatStatus(tracker, getModel()));
    return true;
  }

  if (trimmed.toLowerCase().startsWith("/model")) {
    const arg = trimmed.slice("/model".length).trim();
    if (arg.length === 0) {
      writeLine(`Current model: ${getModel()}`);
    } else {
      const previousModel = getModel();
      setModel(arg);
      writeLine(`Model switched: ${previousModel} → ${arg}`);
    }
    return true;
  }

  if (trimmed.toLowerCase().startsWith("/remember")) {
    const fact = trimmed.slice("/remember".length).trim();
    const stored = await remember(projectRoot, fact);
    writeLine(`Remembered ${stored.id}: ${stored.text}`);
    return true;
  }

  if (trimmed.toLowerCase().startsWith("/recall")) {
    const query = trimmed.slice("/recall".length).trim();
    const memories = await recall(projectRoot, query.length > 0 ? query : undefined);

    if (memories.length === 0) {
      writeLine("No memories matched.");
      return true;
    }

    for (const line of formatMemories(memories)) {
      writeLine(line);
    }
    return true;
  }

  if (trimmed.toLowerCase().startsWith("/forget")) {
    const memoryId = trimmed.slice("/forget".length).trim();
    const result = await forget(projectRoot, memoryId);
    writeLine(result.removed ? `Forgot ${memoryId}.` : `Memory not found: ${memoryId}`);
    return true;
  }

  return false;
}
