import type { Config } from "../config/index.js";
import type { ResolvedConfig } from "../config/types.js";

type RunCliDependencies = {
  cwd: string;
  env: NodeJS.ProcessEnv;
  loadConfig: (options?: { cwd?: string }) => Config;
  loadProjectInstructions: (cwd: string) => string | null;
  assertResumeTarget: (projectRoot: string, sessionId: string) => Promise<void>;
  startRepl: (apiKey: string, config: ResolvedConfig) => Promise<void>;
  writeError: (message: string) => void;
  exit: (code: number) => void;
};

function parseResumeSessionId(args: string[]): string | undefined {
  const resumeIndex = args.indexOf("--resume");
  if (resumeIndex === -1) {
    return undefined;
  }

  return args[resumeIndex + 1];
}

function parsePlanMode(args: string[]): boolean {
  return args.includes("--plan");
}

export async function runCli(args: string[], dependencies: RunCliDependencies): Promise<void> {
  const {
    cwd,
    env,
    loadConfig,
    loadProjectInstructions,
    assertResumeTarget,
    startRepl,
    writeError,
    exit,
  } = dependencies;

  const apiKey = env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    writeError("Error: ANTHROPIC_API_KEY is not set. Set it in your environment or .env file.");
    exit(1);
    return;
  }

  const resumeSessionId = parseResumeSessionId(args);
  const planMode = parsePlanMode(args);

  const config = loadConfig({ cwd });
  const projectInstructions = loadProjectInstructions(cwd);

  if (resumeSessionId) {
    try {
      await assertResumeTarget(cwd, resumeSessionId);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      writeError(message);
      exit(1);
      return;
    }
  }

  await startRepl(apiKey, {
    ...config,
    projectInstructions,
    projectRoot: cwd,
    resumeSessionId,
    planMode,
  });
}
