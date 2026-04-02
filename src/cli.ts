import "dotenv/config";

import chalk from "chalk";
import { Command } from "commander";
import { readFileSync } from "node:fs";

type PackageMetadata = {
  name: string;
  version: string;
  description: string;
};

function readPackageMetadata(): PackageMetadata {
  const packageJsonText = readFileSync(new URL("../package.json", import.meta.url), "utf8");
  return JSON.parse(packageJsonText) as PackageMetadata;
}

const metadata = readPackageMetadata();

const program = new Command();

program.name(metadata.name).description(metadata.description).version(metadata.version);
program.option("--resume <sessionId>", "Resume a saved session by identifier");
program.option("--plan", "Start in plan mode (read-only, no mutating tools)");

program.action(async (_options, command) => {
  const parsed = command.opts() as { resume?: string; plan?: boolean };
  const args: string[] = [];
  if (parsed.resume) {
    args.push("--resume", parsed.resume);
  }
  if (parsed.plan) {
    args.push("--plan");
  }

  const { runCli } = await import("./cli/runCli.js");
  const { loadConfig, loadProjectInstructions } = await import("./config/index.js");
  const { loadSessionForResume } = await import("./persistence/sessions.js");
  const { startRepl } = await import("./repl.js");

  await runCli(args, {
    cwd: process.cwd(),
    env: process.env,
    loadConfig,
    loadProjectInstructions,
    assertResumeTarget: async (projectRoot, sessionId) => {
      await loadSessionForResume(projectRoot, sessionId);
    },
    startRepl,
    writeError: (message) => console.error(chalk.red(message)),
    exit: (code) => process.exit(code),
  });
});

program.parse();
