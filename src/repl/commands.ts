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
  planMode?: boolean;
  togglePlanMode?: () => boolean;
};

function formatStatus(tracker: TokenTracker): string {
  const stats = tracker.getStats();
  const percentage = stats.usagePercentage.toFixed(1);
  const warning = stats.usagePercentage >= 75
    ? chalk.yellow("Status: Approaching limit - compression will trigger soon")
    : chalk.green("Status: OK");

  return [
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

  const { projectRoot, tracker, writeLine, remember, recall, forget, togglePlanMode } = options;

  if (trimmed.toLowerCase() === "/status") {
    writeLine(formatStatus(tracker));
    return true;
  }

  if (trimmed.toLowerCase() === "/plan") {
    if (togglePlanMode) {
      const newState = togglePlanMode();
      writeLine(
        newState
          ? chalk.yellow("Plan mode ON — mutating tools disabled.")
          : chalk.green("Plan mode OFF — mutating tools re-enabled."),
      );
    } else {
      writeLine(chalk.dim("Plan mode toggle not available."));
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
