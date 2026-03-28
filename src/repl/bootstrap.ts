import type { Message } from "../api/anthropic.js";
import type { MemoryIndexEntry } from "../persistence/memory.js";
import type { SessionSummary, SessionTranscript } from "../persistence/sessions.js";

type FreshBootstrapOptions = {
  mode: "fresh";
  projectRoot: string;
  loadDurableMemories: (projectRoot: string) => Promise<MemoryIndexEntry[]>;
  loadRecentSessionSummaries: (
    projectRoot: string,
  ) => Promise<{ sessionSummaries: SessionSummary[] } | SessionSummary[]>;
};

type ResumeBootstrapOptions = {
  mode: "resume";
  projectRoot: string;
  sessionId: string;
  loadSessionForResume: (
    projectRoot: string,
    sessionId: string,
  ) => Promise<SessionTranscript>;
};

export type SessionBootstrap =
  | {
    mode: "fresh";
    messages: Message[];
    durableMemories: MemoryIndexEntry[];
    sessionSummaries: SessionSummary[];
  }
  | {
    mode: "resume";
    sessionId: string;
    messages: Message[];
    transcript: SessionTranscript;
  };

function formatFreshContext(
  durableMemories: MemoryIndexEntry[],
  sessionSummaries: SessionSummary[],
): string | null {
  const sections: string[] = [];

  if (durableMemories.length > 0) {
    sections.push(
      [
        "Durable memories:",
        ...durableMemories.map((memory) => `- ${memory.text}`),
      ].join("\n"),
    );
  }

  if (sessionSummaries.length > 0) {
    sections.push(
      [
        "Recent session summaries:",
        ...sessionSummaries.map((summary) => `- ${summary.summaryText}`),
      ].join("\n"),
    );
  }

  if (sections.length === 0) {
    return null;
  }

  return sections.join("\n\n");
}

export async function buildSessionBootstrap(
  options: FreshBootstrapOptions | ResumeBootstrapOptions,
): Promise<SessionBootstrap> {
  if (options.mode === "resume") {
    const transcript = await options.loadSessionForResume(
      options.projectRoot,
      options.sessionId,
    );

    return {
      mode: "resume",
      sessionId: options.sessionId,
      transcript,
      messages: transcript.messages,
    };
  }

  const durableMemories = await options.loadDurableMemories(options.projectRoot);
  const loadedSummaries = await options.loadRecentSessionSummaries(options.projectRoot);
  const sessionSummaries = Array.isArray(loadedSummaries)
    ? loadedSummaries
    : loadedSummaries.sessionSummaries;
  const freshContext = formatFreshContext(durableMemories, sessionSummaries);

  const messages: Message[] = freshContext
    ? [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Bootstrap context for this fresh session:\n${freshContext}`,
          },
        ],
      },
    ]
    : [];

  return {
    mode: "fresh",
    messages,
    durableMemories,
    sessionSummaries,
  };
}
