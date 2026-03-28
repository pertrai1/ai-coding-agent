import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

export type MemoryEntry = {
  id: string;
  text: string;
};

export type MemoryIndexEntry = MemoryEntry & {
  createdAt: string;
  updatedAt: string;
  path: string;
  tokens: string[];
};

type MemoryIndex = {
  entries: MemoryIndexEntry[];
};

type MemoryStorePaths = {
  rootDir: string;
  entriesDir: string;
  indexPath: string;
};

function getMemoryStorePaths(projectRoot: string): MemoryStorePaths {
  const rootDir = join(projectRoot, ".ai-agent", "memory");
  return {
    rootDir,
    entriesDir: join(rootDir, "entries"),
    indexPath: join(rootDir, "index.json"),
  };
}

function normalizeTokens(text: string): string[] {
  return Array.from(
    new Set(
      text
        .toLowerCase()
        .split(/[^a-z0-9]+/u)
        .filter((token) => token.length > 0),
    ),
  );
}

async function writeIndex(indexPath: string, index: MemoryIndex): Promise<void> {
  await writeFile(indexPath, JSON.stringify(index, null, 2));
}

async function readIndex(indexPath: string): Promise<MemoryIndex> {
  try {
    const text = await readFile(indexPath, "utf8");
    return JSON.parse(text) as MemoryIndex;
  } catch (error: unknown) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return { entries: [] };
    }
    throw error;
  }
}

export async function ensureMemoryStore(
  projectRoot: string,
): Promise<{ indexPath: string; entriesDir: string }> {
  const { entriesDir, indexPath } = getMemoryStorePaths(projectRoot);

  await mkdir(entriesDir, { recursive: true });

  try {
    await readFile(indexPath, "utf8");
  } catch (error: unknown) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      await writeIndex(indexPath, { entries: [] });
    } else {
      throw error;
    }
  }

  return { indexPath, entriesDir };
}

export async function remember(projectRoot: string, text: string): Promise<MemoryIndexEntry> {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    throw new Error("Cannot remember empty content.");
  }

  const { entriesDir, indexPath } = await ensureMemoryStore(projectRoot);
  const index = await readIndex(indexPath);
  const now = new Date().toISOString();
  const id = `mem_${randomUUID()}`;
  const path = join(entriesDir, `${id}.json`);

  const entry: MemoryIndexEntry = {
    id,
    text: trimmed,
    createdAt: now,
    updatedAt: now,
    path,
    tokens: normalizeTokens(trimmed),
  };

  await writeFile(
    path,
    JSON.stringify(
      {
        id: entry.id,
        text: entry.text,
      },
      null,
      2,
    ),
  );

  index.entries.push(entry);
  await writeIndex(indexPath, index);

  return entry;
}

function scoreEntry(entry: MemoryIndexEntry, queryTokens: string[]): number {
  const entryTokens = new Set(entry.tokens);
  let score = 0;

  for (const token of queryTokens) {
    if (entryTokens.has(token)) {
      score += 1;
    }
  }

  return score;
}

export async function recall(projectRoot: string, query?: string): Promise<MemoryIndexEntry[]> {
  const { indexPath } = getMemoryStorePaths(projectRoot);
  const index = await readIndex(indexPath);

  const trimmedQuery = query?.trim() ?? "";
  if (trimmedQuery.length === 0) {
    return [...index.entries];
  }

  const queryTokens = normalizeTokens(trimmedQuery);

  const ranked = [...index.entries]
    .map((entry) => ({ entry, score: scoreEntry(entry, queryTokens) }))
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      return left.entry.createdAt.localeCompare(right.entry.createdAt);
    })
    .map(({ entry, score }) => ({ entry, score }));

  if (ranked.length === 0 || ranked[0].score === 0) {
    return [];
  }

  return ranked.map(({ entry }) => entry);
}

export async function forget(projectRoot: string, memoryId: string): Promise<{ removed: boolean }> {
  const { indexPath } = getMemoryStorePaths(projectRoot);
  const index = await readIndex(indexPath);
  const existing = index.entries.find((entry) => entry.id === memoryId);

  if (!existing) {
    return { removed: false };
  }

  await rm(existing.path, { force: true });
  await writeIndex(indexPath, {
    entries: index.entries.filter((entry) => entry.id !== memoryId),
  });

  return { removed: true };
}

export async function loadMemoryBootstrap(projectRoot: string): Promise<MemoryIndexEntry[]> {
  return recall(projectRoot);
}
