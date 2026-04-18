import { createInterface } from "node:readline/promises";
import chalk from "chalk";

import { AnthropicError } from "./api/anthropic.js";
import type { Message } from "./api/anthropic.js";
import { runAgentLoop } from "./agent.js";
import { assembleSystemPrompt } from "./config/context.js";
import type { ResolvedConfig } from "./config/types.js";
import { TokenTracker } from "./context/tracker.js";
import { loadMemoryBootstrap, remember, recall, forget } from "./persistence/memory.js";
import {
  createSessionId,
  loadFreshSessionBootstrap,
  loadSessionForResume,
  persistCompletedSession,
  type SessionSummary,
  type SessionTranscript,
} from "./persistence/sessions.js";
import { buildSessionBootstrap } from "./repl/bootstrap.js";
import { handleSlashCommand } from "./repl/commands.js";
import { createToolRegistry } from "./tools/index.js";
import { createSubagentTool } from "./subagent/tool.js";

const BASE_SYSTEM_PROMPT =
  "You are an AI coding assistant. You help users with programming questions, debug code, and write new code. Be concise and provide working code examples when appropriate.";

const PLAN_MODE_PROMPT = `You are currently in PLAN MODE. In this mode you must:
- Analyze the codebase using read-only tools (read_file, glob, grep)
- Ask the user clarifying questions if needed
- Produce a clear, ordered plan of actionable steps
- NOT make any code changes (write_file, edit_file, and bash are disabled)

When you have finished your analysis, present a numbered plan of steps you would take. The user will review and approve before you proceed.`;

const DEFAULT_MODEL = "claude-sonnet-4-20250514";
const PLAN_PROMPT = "[plan] > ";
const NORMAL_PROMPT = "> ";
const EXIT_COMMANDS = new Set(["exit", "quit"]);
const STATUS_COMMAND = "/status";
const MUTATING_TOOLS = new Set(["write_file", "edit_file", "bash"]);

export function isExitCommand(input: string): boolean {
  return EXIT_COMMANDS.has(input.trim().toLowerCase());
}

export function isEmptyInput(input: string): boolean {
  return input.trim() === "";
}

export function isStatusCommand(input: string): boolean {
  return input.trim().toLowerCase() === STATUS_COMMAND;
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

function formatToolInput(toolName: string, toolInput: Record<string, unknown>): string {
  const lines: string[] = [];
  for (const [key, value] of Object.entries(toolInput)) {
    const display = typeof value === "string" && value.length > 120
      ? value.slice(0, 120) + "..."
      : String(value);
    lines.push(`  ${key}: ${display}`);
  }
  return lines.join("\n");
}

function createPromptForApproval(
  rl: ReturnType<typeof createInterface>,
): (toolName: string, toolInput: Record<string, unknown>) => Promise<boolean> {
  return async (toolName: string, toolInput: Record<string, unknown>): Promise<boolean> => {
    process.stdout.write("\n");
    console.log(chalk.yellow(`⚡ Tool: ${toolName}`));
    console.log(chalk.dim(formatToolInput(toolName, toolInput)));
    const answer = await rl.question(chalk.yellow("  Allow? (y/n): "));
    return answer.trim().toLowerCase() === "y";
  };
}

export async function startRepl(apiKey: string, config: ResolvedConfig = {}): Promise<void> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const toolRegistry = createToolRegistry(config.permissions);

  // Register subagent tool
  toolRegistry.register(
    createSubagentTool({
      toolRegistry,
      getModel: () => model,
      apiKey,
      systemPrompt: assembleSystemPrompt(
        BASE_SYSTEM_PROMPT,
        config.projectInstructions ?? null,
        config.systemPromptExtra,
      ),
    }),
  );
  const promptForApproval = createPromptForApproval(rl);
  const tokenTracker = new TokenTracker();
  let model = config.model ?? DEFAULT_MODEL;
  const projectRoot = config.projectRoot;
  const systemPrompt = assembleSystemPrompt(
    BASE_SYSTEM_PROMPT,
    config.projectInstructions ?? null,
    config.systemPromptExtra,
  );
  const bootstrap = projectRoot
    ? await buildSessionBootstrap(
      config.resumeSessionId
        ? {
          mode: "resume",
          projectRoot,
          sessionId: config.resumeSessionId,
          loadSessionForResume,
        }
        : {
          mode: "fresh",
          projectRoot,
          loadDurableMemories: loadMemoryBootstrap,
          loadRecentSessionSummaries: loadFreshSessionBootstrap,
        },
    )
    : {
      mode: "fresh" as const,
      messages: [] as Message[],
      durableMemories: [],
      sessionSummaries: [],
    };
  const messages: Message[] = [...bootstrap.messages];
  const bootstrapMessageCount = bootstrap.mode === "fresh" ? bootstrap.messages.length : 0;
  const sessionId = bootstrap.mode === "resume" ? bootstrap.sessionId : createSessionId();
  const sessionCreatedAt =
    bootstrap.mode === "resume" ? bootstrap.transcript.createdAt : new Date().toISOString();
  let shouldPersistSession = bootstrap.mode === "resume" && bootstrap.transcript.messages.length > 0;
  let planMode = false;

  if (bootstrap.mode === "resume") {
    tokenTracker.hydrateSession(
      bootstrap.transcript.tokenUsage,
      bootstrap.transcript.messages.length,
    );
  }

  console.log(chalk.cyan("AI Coding Agent"));
  console.log(chalk.dim('Type "exit" or "quit" to leave. Type /status for context info.\n'));

  try {
    while (true) {
      let input: string;
      try {
        input = await rl.question(planMode ? PLAN_PROMPT : NORMAL_PROMPT);
      } catch (error: unknown) {
        if (isAbortError(error)) {
          process.stdout.write("\n");
          console.log(chalk.cyan("Goodbye!"));
          return;
        }
        throw error;
      }

      const trimmed = input.trim();

      if (isEmptyInput(input)) {
        continue;
      }

      if (isExitCommand(input)) {
        console.log(chalk.cyan("Goodbye!"));
        return;
      }

      if (await handleSlashCommand(input, {
        projectRoot: projectRoot ?? process.cwd(),
        tracker: tokenTracker,
        writeLine: (line) => console.log(line),
        remember,
        recall,
        forget,
        getModel: () => model,
        setModel: (newModel: string) => { model = newModel; },
        getPlanMode: () => planMode,
        setPlanMode: (active: boolean) => { planMode = active; },
      })) {
        continue;
      }

      messages.push({
        role: "user",
        content: [{ type: "text", text: trimmed }],
      });
      tokenTracker.addMessage();
      shouldPersistSession = true;

      try {
        const activeSystemPrompt = planMode
          ? systemPrompt + "\n\n" + PLAN_MODE_PROMPT
          : systemPrompt;

        await runAgentLoop({
          messages,
          toolRegistry,
          model,
          apiKey,
          system: activeSystemPrompt,
          write: (text) => process.stdout.write(text),
          promptForApproval,
          tokenTracker,
          isToolDenied: planMode
            ? (toolName: string) => MUTATING_TOOLS.has(toolName)
            : undefined,
        });

        process.stdout.write("\n");

        if (planMode) {
          const approval = await rl.question(
            chalk.yellow("\n📋 Approve this plan? (y to approve / n to reject / or type modifications): "),
          );
          const approvalTrimmed = approval.trim().toLowerCase();

          if (approvalTrimmed === "y") {
            planMode = false;
            messages.push({
              role: "user",
              content: [{ type: "text", text: "Plan approved. Please proceed with implementation." }],
            });
            tokenTracker.addMessage();
            shouldPersistSession = true;
          } else if (approvalTrimmed === "n") {
            messages.push({
              role: "user",
              content: [{ type: "text", text: "Plan rejected. Please revise the plan." }],
            });
            tokenTracker.addMessage();
            shouldPersistSession = true;
          } else {
            messages.push({
              role: "user",
              content: [{ type: "text", text: `Plan feedback: ${approval.trim()}` }],
            });
            tokenTracker.addMessage();
            shouldPersistSession = true;
          }
        }
      } catch (error: unknown) {
        process.stdout.write("\n");

        if (isAbortError(error)) {
          console.log(chalk.cyan("Goodbye!"));
          return;
        }

        if (error instanceof AnthropicError) {
          if (error.statusCode) {
            console.error(chalk.red(`API error (${error.statusCode}): ${error.message}`));
          } else {
            console.error(chalk.red(`Error: ${error.message}`));
          }
          continue;
        }

        const message = error instanceof Error ? error.message : String(error);
        console.error(chalk.red(`Error: ${message}`));
      }
    }
  } finally {
    rl.close();

    if (projectRoot && shouldPersistSession) {
      const transcriptMessages = messages.slice(bootstrapMessageCount) as SessionTranscript["messages"];

      if (transcriptMessages.length > 0) {
        const totals = tokenTracker.getTotals();
        await persistCompletedSession(projectRoot, {
          transcript: {
            sessionId,
            createdAt: sessionCreatedAt,
            updatedAt: new Date().toISOString(),
            model,
            messages: transcriptMessages,
            tokenUsage: {
              inputTokens: totals.inputTokens,
              outputTokens: totals.outputTokens,
            },
          },
          summarizeSession: async (transcript) => summarizeSessionTranscript(transcript),
        });
      }
    }
  }
}

async function summarizeSessionTranscript(
  transcript: SessionTranscript,
): Promise<SessionSummary> {
  const firstUserText = transcript.messages
    .find((message) => message.role === "user")
    ?.content.map((block) => block.text).join(" ");
  const lastAssistantText = [...transcript.messages]
    .reverse()
    .find((message) => message.role === "assistant")
    ?.content.map((block) => block.text).join(" ");

  const summaryParts = [
    firstUserText ? `Started with: ${firstUserText}` : null,
    lastAssistantText ? `Latest assistant response: ${lastAssistantText}` : null,
  ].filter((part): part is string => part !== null);

  return {
    sessionId: transcript.sessionId,
    completedAt: transcript.updatedAt,
    summaryText:
      summaryParts.length > 0
        ? summaryParts.join(" ")
        : `Session ${transcript.sessionId} completed with ${transcript.messages.length} messages.`,
  };
}
