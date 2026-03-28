import type { ToolPermission } from "../tools/index.js";

export type Config = {
  model?: string;
  systemPromptExtra?: string;
  permissions?: Record<string, ToolPermission>;
};

export type ResolvedConfig = Config & {
  projectInstructions?: string | null;
  projectRoot?: string;
  resumeSessionId?: string;
};
