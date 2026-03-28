import { homedir } from "node:os";
import { join } from "node:path";

import type { ToolPermission } from "../tools/index.js";
import { loadConfigFile } from "./loader.js";
import { mergeConfigs } from "./merge.js";
import type { Config } from "./types.js";

export type { Config, ResolvedConfig } from "./types.js";
export { loadConfigFile } from "./loader.js";
export { mergeConfigs } from "./merge.js";
export { loadProjectInstructions, assembleSystemPrompt } from "./context.js";

const VALID_PERMISSIONS = new Set<ToolPermission>(["allow", "prompt", "deny"]);

type LoadConfigOptions = {
  cwd?: string;
  globalConfigDir?: string;
};

function validatePermissions(config: Config): Config {
  if (!config.permissions) return config;

  const validated: Record<string, ToolPermission> = {};
  for (const [tool, perm] of Object.entries(config.permissions)) {
    if (VALID_PERMISSIONS.has(perm as ToolPermission)) {
      validated[tool] = perm as ToolPermission;
    } else {
      console.warn(`Warning: invalid permission value "${perm}" for tool "${tool}", skipping`);
    }
  }

  return {
    ...config,
    permissions: Object.keys(validated).length > 0 ? validated : undefined,
  };
}

export function loadConfig(options: LoadConfigOptions = {}): Config {
  const cwd = options.cwd ?? process.cwd();
  const globalConfigDir = options.globalConfigDir ?? join(homedir(), ".config", "ai-agent");

  const globalPath = join(globalConfigDir, "config.json");
  const projectPath = join(cwd, ".ai-agent", "config.json");
  const localPath = join(cwd, ".ai-agent", "config.local.json");

  const globalConfig = loadConfigFile(globalPath);
  const projectConfig = loadConfigFile(projectPath);
  const localConfig = loadConfigFile(localPath);

  const merged = mergeConfigs([globalConfig, projectConfig, localConfig]);

  return validatePermissions(merged);
}
