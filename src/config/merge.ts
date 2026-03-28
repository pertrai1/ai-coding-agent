import type { Config } from "./types.js";

export function mergeConfigs(configs: (Config | null)[]): Config {
  const result: Config = {};

  for (const config of configs) {
    if (!config) continue;

    if (config.model !== undefined) {
      result.model = config.model;
    }

    if (config.systemPromptExtra !== undefined) {
      result.systemPromptExtra = config.systemPromptExtra;
    }

    if (config.permissions) {
      result.permissions = { ...result.permissions, ...config.permissions };
    }
  }

  return result;
}
