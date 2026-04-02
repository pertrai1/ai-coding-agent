import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { TokenTracker } from "../context/tracker.js";

type TranscriptMessage = {
  role: "user" | "assistant";
  content: Array<{ type: "text"; text: string }>;
};

type SessionTranscript = {
  sessionId: string;
  createdAt: string;
  updatedAt: string;
  model: string;
  messages: TranscriptMessage[];
  tokenUsage: {
    inputTokens: number;
    outputTokens: number;
  };
};

type SessionSummary = {
  sessionId: string;
  completedAt: string;
  summaryText: string;
  touchedFiles?: string[];
  notableDecisions?: string[];
};

const tempDirs: string[] = [];

async function createTempProjectRoot(): Promise<string> {
  const tempDir = await mkdtemp(join(tmpdir(), "step7-spec-anchors-"));
  tempDirs.push(tempDir);
  return tempDir;
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function readJsonFile<T>(path: string): Promise<T> {
  const text = await readFile(path, "utf8");
  return JSON.parse(text) as T;
}

function createTranscript(
  sessionId = "session_abc",
  messages: TranscriptMessage[] = [
    { role: "user", content: [{ type: "text", text: "Please inspect the config loader." }] },
    { role: "assistant", content: [{ type: "text", text: "I inspected the config loader." }] },
  ],
): SessionTranscript {
  return {
    sessionId,
    createdAt: "2026-03-28T12:00:00.000Z",
    updatedAt: "2026-03-28T12:15:00.000Z",
    model: "claude-sonnet-4-20250514",
    messages,
    tokenUsage: {
      inputTokens: 120,
      outputTokens: 45,
    },
  };
}

function createSummary(
  sessionId = "session_abc",
  summaryText = "Reviewed the config loader and decided local config should win.",
): SessionSummary {
  return {
    sessionId,
    completedAt: "2026-03-28T12:15:00.000Z",
    summaryText,
    touchedFiles: ["src/config/loader.ts"],
    notableDecisions: ["Local config overrides project config."],
  };
}

async function loadMemoryModule() {
  const moduleUrl = new URL("../persistence/memory.js", import.meta.url).href;
  return import(moduleUrl);
}

async function loadSessionsModule() {
  const moduleUrl = new URL("../persistence/sessions.js", import.meta.url).href;
  return import(moduleUrl);
}

async function loadCliAppModule() {
  const moduleUrl = new URL("../cli/runCli.js", import.meta.url).href;
  return import(moduleUrl);
}

async function loadReplCommandsModule() {
  const moduleUrl = new URL("../repl/commands.js", import.meta.url).href;
  return import(moduleUrl);
}

async function loadReplBootstrapModule() {
  const moduleUrl = new URL("../repl/bootstrap.js", import.meta.url).href;
  return import(moduleUrl);
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  vi.restoreAllMocks();
  vi.resetModules();
});

describe("Step 7 spec anchors", () => {
  describe("memory-store", () => {
    // Spec: memory-store > Project memory storage layout > "Memory storage is initialized on first use"
    it("initializes memory storage on first use", async () => {
      const projectRoot = await createTempProjectRoot();
      const memory = await loadMemoryModule();

      const result = await memory.ensureMemoryStore(projectRoot);

      expect(result).toEqual({
        indexPath: join(projectRoot, ".ai-agent", "memory", "index.json"),
        entriesDir: join(projectRoot, ".ai-agent", "memory", "entries"),
      });
      expect(await pathExists(result.indexPath)).toBe(true);
      expect(await pathExists(result.entriesDir)).toBe(true);
      expect(await readJsonFile<{ entries: unknown[] }>(result.indexPath)).toEqual({ entries: [] });
    });

    // Spec: memory-store > Project memory storage layout > "Existing memory storage is reused"
    it("reuses existing memory storage without resetting it", async () => {
      const projectRoot = await createTempProjectRoot();
      const memoryRoot = join(projectRoot, ".ai-agent", "memory");
      const entriesDir = join(memoryRoot, "entries");
      const indexPath = join(memoryRoot, "index.json");
      const entryPath = join(entriesDir, "mem_existing.json");

      await mkdir(entriesDir, { recursive: true });
      await writeFile(indexPath, JSON.stringify({
        entries: [
          {
            id: "mem_existing",
            text: "Use npm in this repository.",
            createdAt: "2026-03-28T12:00:00.000Z",
            updatedAt: "2026-03-28T12:00:00.000Z",
            path: entryPath,
            tokens: ["use", "npm", "repository"],
          },
        ],
      }));
      await writeFile(entryPath, JSON.stringify({ id: "mem_existing", text: "Use npm in this repository." }));

      const memory = await loadMemoryModule();
      const result = await memory.ensureMemoryStore(projectRoot);

      expect(result.indexPath).toBe(indexPath);
      expect(await readJsonFile<{ entries: Array<{ id: string }> }>(indexPath)).toEqual({
        entries: [
          {
            id: "mem_existing",
            text: "Use npm in this repository.",
            createdAt: "2026-03-28T12:00:00.000Z",
            updatedAt: "2026-03-28T12:00:00.000Z",
            path: entryPath,
            tokens: ["use", "npm", "repository"],
          },
        ],
      });
    });

    // Spec: memory-store > Remember operation persists durable facts > "Remember creates a new memory entry"
    it("creates a new durable memory entry", async () => {
      const projectRoot = await createTempProjectRoot();
      const memory = await loadMemoryModule();

      const result = await memory.remember(projectRoot, "Preferred package manager is npm");

      expect(result).toMatchObject({
        id: expect.stringMatching(/^mem_/),
        text: "Preferred package manager is npm",
        path: join(projectRoot, ".ai-agent", "memory", "entries", `${result.id}.json`),
      });
      expect(await pathExists(result.path)).toBe(true);
      expect(await readJsonFile<{ id: string; text: string }>(result.path)).toEqual({
        id: result.id,
        text: "Preferred package manager is npm",
      });

      const index = await readJsonFile<{ entries: Array<{ id: string; text: string }> }>(
        join(projectRoot, ".ai-agent", "memory", "index.json"),
      );
      expect(index.entries).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: result.id,
            text: "Preferred package manager is npm",
          }),
        ]),
      );
    });

    // Spec: memory-store > Remember operation persists durable facts > "Remember rejects empty content"
    it("rejects empty memory content", async () => {
      const projectRoot = await createTempProjectRoot();
      const memory = await loadMemoryModule();

      await expect(memory.remember(projectRoot, "")).rejects.toThrow(/empty/i);
      expect(await pathExists(join(projectRoot, ".ai-agent", "memory", "index.json"))).toBe(false);
    });

    // Spec: memory-store > Recall operation retrieves indexed memories > "Recall with query returns ranked matches"
    it("recalls ranked matches for a query", async () => {
      const projectRoot = await createTempProjectRoot();
      const memory = await loadMemoryModule();

      await memory.remember(projectRoot, "Use npm");
      await memory.remember(projectRoot, "Primary model is claude-sonnet");

      const results = await memory.recall(projectRoot, "model");

      expect(results[0]).toMatchObject({ text: "Primary model is claude-sonnet" });
      expect(results[1]).toMatchObject({ text: "Use npm" });
    });

    // Spec: memory-store > Recall operation retrieves indexed memories > "Recall without query lists memories"
    it("lists active memories when no recall query is provided", async () => {
      const projectRoot = await createTempProjectRoot();
      const memory = await loadMemoryModule();

      const first = await memory.remember(projectRoot, "Use npm");
      const second = await memory.remember(projectRoot, "Run tests before commit");
      const third = await memory.remember(projectRoot, "Stay in strict TypeScript mode");

      const results = await memory.recall(projectRoot);

      expect(results).toEqual([
        expect.objectContaining({ id: first.id, text: "Use npm" }),
        expect.objectContaining({ id: second.id, text: "Run tests before commit" }),
        expect.objectContaining({ id: third.id, text: "Stay in strict TypeScript mode" }),
      ]);
    });

    // Spec: memory-store > Recall operation retrieves indexed memories > "Recall with no matches reports empty result"
    it("returns an empty result when recall finds no matches", async () => {
      const projectRoot = await createTempProjectRoot();
      const memory = await loadMemoryModule();

      await memory.remember(projectRoot, "Use npm");

      const results = await memory.recall(projectRoot, "deployment");

      expect(results).toEqual([]);
    });

    // Spec: memory-store > Forget operation removes selected memories > "Forget removes an existing memory"
    it("forgets an existing memory entry", async () => {
      const projectRoot = await createTempProjectRoot();
      const memory = await loadMemoryModule();
      const created = await memory.remember(projectRoot, "Use npm");

      const result = await memory.forget(projectRoot, created.id);

      expect(result).toEqual({ removed: true });
      expect(await pathExists(created.path)).toBe(false);

      const index = await readJsonFile<{ entries: Array<{ id: string }> }>(
        join(projectRoot, ".ai-agent", "memory", "index.json"),
      );
      expect(index.entries).toEqual(expect.not.arrayContaining([expect.objectContaining({ id: created.id })]));
    });

    // Spec: memory-store > Forget operation removes selected memories > "Forget of unknown id is non-destructive"
    it("leaves the store unchanged when forgetting an unknown memory id", async () => {
      const projectRoot = await createTempProjectRoot();
      const memory = await loadMemoryModule();
      const created = await memory.remember(projectRoot, "Use npm");

      const result = await memory.forget(projectRoot, "mem_missing");

      expect(result).toEqual({ removed: false });
      expect(await pathExists(created.path)).toBe(true);

      const index = await readJsonFile<{ entries: Array<{ id: string }> }>(
        join(projectRoot, ".ai-agent", "memory", "index.json"),
      );
      expect(index.entries).toEqual(expect.arrayContaining([expect.objectContaining({ id: created.id })]));
    });

    // Spec: memory-store > Memory index is available for session bootstrap > "Fresh session loads stored memories"
    it("loads stored memories for fresh-session bootstrap", async () => {
      const projectRoot = await createTempProjectRoot();
      const memory = await loadMemoryModule();

      const first = await memory.remember(projectRoot, "Use npm");
      const second = await memory.remember(projectRoot, "Primary model is claude-sonnet");

      const bootstrapMemories = await memory.loadMemoryBootstrap(projectRoot);

      expect(bootstrapMemories).toEqual([
        expect.objectContaining({ id: first.id, text: "Use npm" }),
        expect.objectContaining({ id: second.id, text: "Primary model is claude-sonnet" }),
      ]);
    });

    // Spec: memory-store > Memory index is available for session bootstrap > "Fresh session with no memory store continues normally"
    it("returns no bootstrap memories when the memory store does not exist", async () => {
      const projectRoot = await createTempProjectRoot();
      const memory = await loadMemoryModule();

      const bootstrapMemories = await memory.loadMemoryBootstrap(projectRoot);

      expect(bootstrapMemories).toEqual([]);
    });
  });

  describe("session-history", () => {
    // Spec: session-history > Session transcripts are persisted for resume > "Completed session is saved"
    it("persists a completed session transcript", async () => {
      const projectRoot = await createTempProjectRoot();
      const sessions = await loadSessionsModule();
      const transcript = createTranscript();

      const result = await sessions.persistCompletedSession(projectRoot, {
        transcript,
        summarizeSession: vi.fn().mockResolvedValue(createSummary(transcript.sessionId)),
      });

      const transcriptPath = join(projectRoot, ".ai-agent", "sessions", `${transcript.sessionId}.json`);
      expect(result).toMatchObject({ transcriptPath });
      expect(await readJsonFile<SessionTranscript>(transcriptPath)).toEqual(transcript);
    });

    // Spec: session-history > Session transcripts are persisted for resume > "Empty session still gets an identifier"
    it("creates a session identifier even before any transcript is persisted", async () => {
      const sessions = await loadSessionsModule();

      const sessionId = sessions.createSessionId();

      expect(sessionId).toMatch(/^session_/);
    });

    // Spec: session-history > Session summaries are stored separately from transcripts > "Summary file is written for a completed session"
    it("writes a summary artifact alongside a saved transcript", async () => {
      const projectRoot = await createTempProjectRoot();
      const sessions = await loadSessionsModule();
      const transcript = createTranscript();
      const summary = createSummary(transcript.sessionId);

      await sessions.persistCompletedSession(projectRoot, {
        transcript,
        summarizeSession: vi.fn().mockResolvedValue(summary),
      });

      const summaryPath = join(projectRoot, ".ai-agent", "sessions", `${transcript.sessionId}.summary.json`);
      expect(await readJsonFile<SessionSummary>(summaryPath)).toEqual(summary);
    });

    // Spec: session-history > Session summaries are stored separately from transcripts > "Summary generation failure does not block transcript persistence"
    it("falls back to a minimal summary when summary generation fails", async () => {
      const projectRoot = await createTempProjectRoot();
      const sessions = await loadSessionsModule();
      const transcript = createTranscript();

      await sessions.persistCompletedSession(projectRoot, {
        transcript,
        summarizeSession: vi.fn().mockRejectedValue(new Error("summary failed")),
      });

      const transcriptPath = join(projectRoot, ".ai-agent", "sessions", `${transcript.sessionId}.json`);
      const summaryPath = join(projectRoot, ".ai-agent", "sessions", `${transcript.sessionId}.summary.json`);

      expect(await readJsonFile<SessionTranscript>(transcriptPath)).toEqual(transcript);
      expect(await pathExists(summaryPath)).toBe(true);

      const summary = await readJsonFile<SessionSummary>(summaryPath);
      expect(summary).toMatchObject({
        sessionId: transcript.sessionId,
      });
      expect(summary.summaryText.length).toBeGreaterThan(0);
    });

    // Spec: session-history > Session resume restores conversation continuity > "Resume loads a saved transcript"
    it("loads a saved session transcript for resume", async () => {
      const projectRoot = await createTempProjectRoot();
      const sessions = await loadSessionsModule();
      const transcript = createTranscript();

      await sessions.persistCompletedSession(projectRoot, {
        transcript,
        summarizeSession: vi.fn().mockResolvedValue(createSummary(transcript.sessionId)),
      });

      const loaded = await sessions.loadSessionForResume(projectRoot, transcript.sessionId);

      expect(loaded).toEqual(transcript);
    });

    // Spec: session-history > Session resume restores conversation continuity > "Missing session id fails startup cleanly"
    it("rejects resume for a missing session id", async () => {
      const projectRoot = await createTempProjectRoot();
      const sessions = await loadSessionsModule();

      await expect(sessions.loadSessionForResume(projectRoot, "session_missing")).rejects.toThrow(/session_missing/i);
    });

    // Spec: session-history > Fresh sessions load prior summaries, not prior transcripts > "Fresh session reads summaries only"
    it("loads summaries without restoring prior transcript messages for a fresh session", async () => {
      const projectRoot = await createTempProjectRoot();
      const sessions = await loadSessionsModule();

      await sessions.persistCompletedSession(projectRoot, {
        transcript: createTranscript("session_one", [
          { role: "user", content: [{ type: "text", text: "Transcript-only detail one" }] },
        ]),
        summarizeSession: vi.fn().mockResolvedValue(createSummary("session_one", "Summary one")),
      });
      await sessions.persistCompletedSession(projectRoot, {
        transcript: createTranscript("session_two", [
          { role: "user", content: [{ type: "text", text: "Transcript-only detail two" }] },
        ]),
        summarizeSession: vi.fn().mockResolvedValue(createSummary("session_two", "Summary two")),
      });
      await sessions.persistCompletedSession(projectRoot, {
        transcript: createTranscript("session_three", [
          { role: "user", content: [{ type: "text", text: "Transcript-only detail three" }] },
        ]),
        summarizeSession: vi.fn().mockResolvedValue(createSummary("session_three", "Summary three")),
      });

      const bootstrap = await sessions.loadFreshSessionBootstrap(projectRoot);

      expect(bootstrap.sessionSummaries).toHaveLength(3);
      expect(JSON.stringify(bootstrap)).toContain("Summary one");
      expect(JSON.stringify(bootstrap)).not.toContain("Transcript-only detail one");
      expect(JSON.stringify(bootstrap)).not.toContain("Transcript-only detail two");
      expect(JSON.stringify(bootstrap)).not.toContain("Transcript-only detail three");
    });

    // Spec: session-history > Fresh sessions load prior summaries, not prior transcripts > "Resumed session does not rely on summary-only bootstrap"
    it("uses the saved transcript instead of summary-only bootstrap during resume", async () => {
      const projectRoot = await createTempProjectRoot();
      const sessions = await loadSessionsModule();
      const transcript = createTranscript("session_resume", [
        { role: "user", content: [{ type: "text", text: "Exact transcript detail" }] },
        { role: "assistant", content: [{ type: "text", text: "Exact transcript response" }] },
      ]);

      await sessions.persistCompletedSession(projectRoot, {
        transcript,
        summarizeSession: vi.fn().mockResolvedValue(createSummary("session_resume", "Only a lightweight summary")),
      });

      const loaded = await sessions.loadSessionForResume(projectRoot, "session_resume");

      expect(JSON.stringify(loaded)).toContain("Exact transcript detail");
      expect(JSON.stringify(loaded)).not.toContain("Only a lightweight summary");
    });
  });

  describe("cli-bootstrap", () => {
    // Spec: cli-bootstrap > CLI entrypoint with commander > "Default command starts a fresh session"
    it("starts a fresh session when no resume target is provided", async () => {
      const projectRoot = await createTempProjectRoot();
      const cli = await loadCliAppModule();
      const loadConfig = vi.fn(() => ({ model: "claude-sonnet-4-20250514" }));
      const loadProjectInstructions = vi.fn(() => "Follow AGENTS.md instructions.");
      const assertResumeTarget = vi.fn();
      const startRepl = vi.fn().mockResolvedValue(undefined);
      const writeError = vi.fn();
      const exit = vi.fn();

      await cli.runCli([], {
        cwd: projectRoot,
        env: { ANTHROPIC_API_KEY: "test-key" },
        loadConfig,
        loadProjectInstructions,
        assertResumeTarget,
        startRepl,
        writeError,
        exit,
      });

      expect(loadConfig).toHaveBeenCalledTimes(1);
      expect(loadProjectInstructions).toHaveBeenCalledWith(projectRoot);
      expect(assertResumeTarget).not.toHaveBeenCalled();
      expect(startRepl).toHaveBeenCalledWith(
        "test-key",
        expect.objectContaining({
          model: "claude-sonnet-4-20250514",
          projectInstructions: "Follow AGENTS.md instructions.",
        }),
      );
      expect(writeError).not.toHaveBeenCalled();
      expect(exit).not.toHaveBeenCalled();
    });

    // Spec: cli-bootstrap > CLI entrypoint with commander > "Default command resumes a saved session"
    it("passes the resume target into REPL startup when --resume is provided", async () => {
      const projectRoot = await createTempProjectRoot();
      const cli = await loadCliAppModule();
      const loadConfig = vi.fn(() => ({ model: "claude-sonnet-4-20250514" }));
      const loadProjectInstructions = vi.fn(() => "Follow AGENTS.md instructions.");
      const assertResumeTarget = vi.fn().mockResolvedValue(undefined);
      const startRepl = vi.fn().mockResolvedValue(undefined);

      await cli.runCli(["--resume", "session_abc"], {
        cwd: projectRoot,
        env: { ANTHROPIC_API_KEY: "test-key" },
        loadConfig,
        loadProjectInstructions,
        assertResumeTarget,
        startRepl,
        writeError: vi.fn(),
        exit: vi.fn(),
      });

      expect(assertResumeTarget).toHaveBeenCalledWith(projectRoot, "session_abc");
      expect(startRepl).toHaveBeenCalledWith(
        "test-key",
        expect.objectContaining({
          resumeSessionId: "session_abc",
        }),
      );
    });

    // Spec: cli-bootstrap > CLI entrypoint with commander > "Invalid resume target stops before REPL launch"
    it("stops before REPL launch when the resume target is invalid", async () => {
      const projectRoot = await createTempProjectRoot();
      const cli = await loadCliAppModule();
      const startRepl = vi.fn().mockResolvedValue(undefined);
      const writeError = vi.fn();
      const exit = vi.fn();

      await cli.runCli(["--resume", "session_missing"], {
        cwd: projectRoot,
        env: { ANTHROPIC_API_KEY: "test-key" },
        loadConfig: vi.fn(() => ({})),
        loadProjectInstructions: vi.fn(() => null),
        assertResumeTarget: vi.fn().mockRejectedValue(new Error("session_missing was not found")),
        startRepl,
        writeError,
        exit,
      });

      expect(writeError).toHaveBeenCalledWith(expect.stringContaining("session_missing"));
      expect(startRepl).not.toHaveBeenCalled();
      expect(exit).toHaveBeenCalledWith(1);
    });
  });

  describe("repl-chat-loop", () => {
    // Spec: repl-chat-loop > REPL input loop > "Status command displays context usage"
    it("handles /status as an internal slash command", async () => {
      const commands = await loadReplCommandsModule();
      const tracker = new TokenTracker();
      tracker.addUsage({ inputTokens: 120, outputTokens: 45 });
      tracker.addMessage();
      const output: string[] = [];

      const handled = await commands.handleSlashCommand("/status", {
        projectRoot: "/tmp/project",
        tracker,
        writeLine: (line: string) => output.push(line),
        remember: vi.fn(),
        recall: vi.fn(),
        forget: vi.fn(),
        getModel: () => "claude-sonnet-4-20250514",
        setModel: vi.fn(),
      });

      expect(handled).toBe(true);
      expect(output.join("\n")).toContain("Context:");
      expect(output.join("\n")).toContain("Messages:");
    });

    // Spec: repl-chat-loop > REPL input loop > "Remember command stores a durable fact"
    it("routes /remember to the internal remember operation", async () => {
      const commands = await loadReplCommandsModule();
      const remember = vi.fn().mockResolvedValue({ id: "mem_123", text: "Always run npm test before commit" });

      const handled = await commands.handleSlashCommand("/remember Always run npm test before commit", {
        projectRoot: "/tmp/project",
        tracker: new TokenTracker(),
        writeLine: vi.fn(),
        remember,
        recall: vi.fn(),
        forget: vi.fn(),
        getModel: () => "claude-sonnet-4-20250514",
        setModel: vi.fn(),
      });

      expect(handled).toBe(true);
      expect(remember).toHaveBeenCalledWith("/tmp/project", "Always run npm test before commit");
    });

    // Spec: repl-chat-loop > REPL input loop > "Recall command lists or searches memories"
    it("routes /recall to the internal recall operation", async () => {
      const commands = await loadReplCommandsModule();
      const writeLine = vi.fn();
      const recall = vi.fn().mockResolvedValue([
        { id: "mem_123", text: "Always run npm test before commit", score: 1 },
      ]);

      const handled = await commands.handleSlashCommand("/recall test", {
        projectRoot: "/tmp/project",
        tracker: new TokenTracker(),
        writeLine,
        remember: vi.fn(),
        recall,
        forget: vi.fn(),
        getModel: () => "claude-sonnet-4-20250514",
        setModel: vi.fn(),
      });

      expect(handled).toBe(true);
      expect(recall).toHaveBeenCalledWith("/tmp/project", "test");
      expect(writeLine).toHaveBeenCalledWith(expect.stringContaining("mem_123"));
    });

    // Spec: repl-chat-loop > REPL input loop > "Forget command removes a memory"
    it("routes /forget to the internal forget operation", async () => {
      const commands = await loadReplCommandsModule();
      const forget = vi.fn().mockResolvedValue({ removed: true });

      const handled = await commands.handleSlashCommand("/forget mem_123", {
        projectRoot: "/tmp/project",
        tracker: new TokenTracker(),
        writeLine: vi.fn(),
        remember: vi.fn(),
        recall: vi.fn(),
        forget,
        getModel: () => "claude-sonnet-4-20250514",
        setModel: vi.fn(),
      });

      expect(handled).toBe(true);
      expect(forget).toHaveBeenCalledWith("/tmp/project", "mem_123");
    });

    // Spec: repl-chat-loop > Session bootstrap mode > "Fresh session injects durable memory context"
    it("builds fresh-session bootstrap context from durable memories", async () => {
      const replBootstrap = await loadReplBootstrapModule();

      const bootstrap = await replBootstrap.buildSessionBootstrap({
        mode: "fresh",
        projectRoot: "/tmp/project",
        loadDurableMemories: vi.fn().mockResolvedValue([
          { id: "mem_123", text: "Always run npm test before commit" },
        ]),
        loadRecentSessionSummaries: vi.fn().mockResolvedValue([]),
      });

      expect(bootstrap.mode).toBe("fresh");
      expect(JSON.stringify(bootstrap)).toContain("Always run npm test before commit");
    });

    // Spec: repl-chat-loop > Session bootstrap mode > "Fresh session injects recent session summaries"
    it("builds fresh-session bootstrap context from recent session summaries without restoring transcripts", async () => {
      const replBootstrap = await loadReplBootstrapModule();

      const bootstrap = await replBootstrap.buildSessionBootstrap({
        mode: "fresh",
        projectRoot: "/tmp/project",
        loadDurableMemories: vi.fn().mockResolvedValue([]),
        loadRecentSessionSummaries: vi.fn().mockResolvedValue([
          createSummary("session_abc", "Summary-only context"),
        ]),
      });

      expect(bootstrap.mode).toBe("fresh");
      expect(JSON.stringify(bootstrap)).toContain("Summary-only context");
      expect(JSON.stringify(bootstrap)).not.toContain("Exact transcript detail");
    });

    // Spec: repl-chat-loop > Session bootstrap mode > "Resumed session restores transcript"
    it("builds resumed-session bootstrap state from the saved transcript", async () => {
      const replBootstrap = await loadReplBootstrapModule();
      const transcript = createTranscript("session_abc", [
        { role: "user", content: [{ type: "text", text: "Resume exact transcript" }] },
        { role: "assistant", content: [{ type: "text", text: "Resume exact response" }] },
      ]);

      const bootstrap = await replBootstrap.buildSessionBootstrap({
        mode: "resume",
        projectRoot: "/tmp/project",
        sessionId: "session_abc",
        loadSessionForResume: vi.fn().mockResolvedValue(transcript),
      });

      expect(bootstrap.mode).toBe("resume");
      expect(bootstrap.messages).toEqual(transcript.messages);
    });

    // Spec: repl-chat-loop > Durable memory remains available in fresh sessions > "Fresh session can answer from durable memory after restart"
    it("keeps durable memory available to a fresh session after restart bootstrap", async () => {
      const replBootstrap = await loadReplBootstrapModule();

      const bootstrap = await replBootstrap.buildSessionBootstrap({
        mode: "fresh",
        projectRoot: "/tmp/project",
        loadDurableMemories: vi.fn().mockResolvedValue([
          { id: "mem_456", text: "Project uses npm workspaces" },
        ]),
        loadRecentSessionSummaries: vi.fn().mockResolvedValue([]),
      });

      expect(JSON.stringify(bootstrap)).toContain("Project uses npm workspaces");
    });
  });
});
