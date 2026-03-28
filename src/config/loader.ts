import { readFileSync } from "node:fs";

import type { Config } from "./types.js";

export function loadConfigFile(filePath: string): Config | null {
  let raw: string;
  try {
    raw = readFileSync(filePath, "utf-8");
  } catch {
    return null;
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    console.warn(`Warning: failed to parse config file ${filePath}`);
    return null;
  }

  const config: Config = {};

  if (typeof parsed.model === "string") {
    config.model = parsed.model;
  }

  if (typeof parsed.systemPromptExtra === "string") {
    config.systemPromptExtra = parsed.systemPromptExtra;
  }

  if (parsed.permissions && typeof parsed.permissions === "object" && !Array.isArray(parsed.permissions)) {
    config.permissions = parsed.permissions as Config["permissions"];
  }

  return config;
}
