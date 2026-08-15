import type { ToolPermission } from "../tools/index.js";

export type McpServerConfig = {
  command: string;
  args?: string[];
  env?: Record<string, string>;
  enabled?: boolean;
};

export type Config = {
  model?: string;
  systemPromptExtra?: string;
  permissions?: Record<string, ToolPermission>;
  mcpServers?: Record<string, McpServerConfig>;
};

export type ResolvedConfig = Config & {
  projectInstructions?: string | null;
  projectRoot?: string;
  resumeSessionId?: string;
};
