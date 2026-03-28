import { mkdir, readFile, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { join } from "node:path";

export type SessionMessage = {
  role: "user" | "assistant";
  content: Array<{ type: "text"; text: string }>;
};

export type SessionTranscript = {
  sessionId: string;
  createdAt: string;
  updatedAt: string;
  model: string;
  messages: SessionMessage[];
  tokenUsage: {
    inputTokens: number;
    outputTokens: number;
  };
};

export type SessionSummary = {
  sessionId: string;
  completedAt: string;
  summaryText: string;
  touchedFiles?: string[];
  notableDecisions?: string[];
};

type PersistCompletedSessionOptions = {
  transcript: SessionTranscript;
  summarizeSession: (transcript: SessionTranscript) => Promise<SessionSummary>;
};

type FreshSessionBootstrap = {
  sessionSummaries: SessionSummary[];
};

function getSessionsDir(projectRoot: string): string {
  return join(projectRoot, ".ai-agent", "sessions");
}

function getTranscriptPath(projectRoot: string, sessionId: string): string {
  return join(getSessionsDir(projectRoot), `${sessionId}.json`);
}

function getSummaryPath(projectRoot: string, sessionId: string): string {
  return join(getSessionsDir(projectRoot), `${sessionId}.summary.json`);
}

async function ensureSessionsDir(projectRoot: string): Promise<string> {
  const sessionsDir = getSessionsDir(projectRoot);
  await mkdir(sessionsDir, { recursive: true });
  return sessionsDir;
}

async function readJsonFile<T>(path: string): Promise<T> {
  const text = await readFile(path, "utf8");
  return JSON.parse(text) as T;
}

function createFallbackSummary(transcript: SessionTranscript): SessionSummary {
  return {
    sessionId: transcript.sessionId,
    completedAt: transcript.updatedAt,
    summaryText:
      transcript.messages.length > 0
        ? `Session ${transcript.sessionId} completed with ${transcript.messages.length} messages.`
        : `Session ${transcript.sessionId} completed.`,
  };
}

export function createSessionId(): string {
  return `session_${randomUUID()}`;
}

export async function persistCompletedSession(
  projectRoot: string,
  options: PersistCompletedSessionOptions,
): Promise<{ transcriptPath: string; summaryPath: string }> {
  await ensureSessionsDir(projectRoot);

  const { transcript, summarizeSession } = options;
  const transcriptPath = getTranscriptPath(projectRoot, transcript.sessionId);
  const summaryPath = getSummaryPath(projectRoot, transcript.sessionId);

  await writeFile(transcriptPath, JSON.stringify(transcript, null, 2));

  let summary: SessionSummary;
  try {
    summary = await summarizeSession(transcript);
  } catch {
    summary = createFallbackSummary(transcript);
  }

  await writeFile(summaryPath, JSON.stringify(summary, null, 2));

  return { transcriptPath, summaryPath };
}

export async function loadSessionForResume(
  projectRoot: string,
  sessionId: string,
): Promise<SessionTranscript> {
  const transcriptPath = getTranscriptPath(projectRoot, sessionId);

  try {
    return await readJsonFile<SessionTranscript>(transcriptPath);
  } catch (error: unknown) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      throw new Error(`Saved session "${sessionId}" was not found.`);
    }
    throw error;
  }
}

export async function loadFreshSessionBootstrap(
  projectRoot: string,
): Promise<FreshSessionBootstrap> {
  const sessionsDir = getSessionsDir(projectRoot);
  await ensureSessionsDir(projectRoot);

  const summaries: SessionSummary[] = [];

  for await (const entry of await import("node:fs/promises").then(({ opendir }) => opendir(sessionsDir))) {
    if (!entry.isFile() || !entry.name.endsWith(".summary.json")) {
      continue;
    }

    const summaryPath = join(sessionsDir, entry.name);
    summaries.push(await readJsonFile<SessionSummary>(summaryPath));
  }

  summaries.sort((left, right) => left.completedAt.localeCompare(right.completedAt));

  return { sessionSummaries: summaries };
}
