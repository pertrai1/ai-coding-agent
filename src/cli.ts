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
const anthropicApiKey = process.env.ANTHROPIC_API_KEY;

const program = new Command();

program.name(metadata.name).description(metadata.description).version(metadata.version);

program.action(() => {
  console.log(chalk.cyan("AI Coding Agent CLI bootstrap is ready."));
  if (!anthropicApiKey) {
    console.log(chalk.yellow("ANTHROPIC_API_KEY is not configured yet (non-blocking for this step)."));
  }
});

program.parse();
