import { readFileSync } from "node:fs";

import type { Config, McpServerConfig } from "./types.js";

function parseMcpServerConfig(value: unknown): McpServerConfig | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const raw = value as Record<string, unknown>;
  if (typeof raw.command !== "string") {
    return null;
  }

  const config: McpServerConfig = {
    command: raw.command,
  };

  if (Array.isArray(raw.args) && raw.args.every((arg) => typeof arg === "string")) {
    config.args = [...raw.args];
  }

  if (raw.env && typeof raw.env === "object" && !Array.isArray(raw.env)) {
    const envEntries = Object.entries(raw.env).filter((entry): entry is [string, string] => {
      return typeof entry[1] === "string";
    });
    if (envEntries.length > 0) {
      config.env = Object.fromEntries(envEntries);
    }
  }

  if (typeof raw.enabled === "boolean") {
    config.enabled = raw.enabled;
  }

  return config;
}

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

  if (parsed.mcpServers && typeof parsed.mcpServers === "object" && !Array.isArray(parsed.mcpServers)) {
    const servers = Object.entries(parsed.mcpServers)
      .map(([name, value]) => {
        const serverConfig = parseMcpServerConfig(value);
        return serverConfig ? [name, serverConfig] : null;
      })
      .filter((entry): entry is [string, McpServerConfig] => entry !== null);

    if (servers.length > 0) {
      config.mcpServers = Object.fromEntries(servers);
    }
  }

  return config;
}
