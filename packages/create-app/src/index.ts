#!/usr/bin/env node
import { createApp, listTemplates } from "@smite/cli";
import type { CreateTemplate } from "@smite/cli";
import { Command } from "commander";

const program = new Command();
const colorEnabled =
  process.stdout.isTTY === true && process.env.NO_COLOR === undefined;
const paint =
  (code: number) =>
  (text: string): string =>
    colorEnabled ? `\u001b[${code}m${text}\u001b[0m` : text;
const green = paint(32);
const cyan = paint(36);
const yellow = paint(33);

program
  .name("create-smite-app")
  .description("Scaffold a new Smite application.")
  .version("0.1.0")
  .argument("<name>", "app name; also the directory and package name")
  .option("--template <template>", "starter template", "default")
  .option("--force", "overwrite an existing directory")
  .action(
    async (name: string, options: { template: string; force?: boolean }) => {
      const dir = await createApp({
        name,
        ...(options.template === "default"
          ? {}
          : { template: options.template as CreateTemplate }),
        ...(options.force === true ? { force: true } : {}),
      });
      console.log(`${green("Scaffolded")} ${cyan(dir)}`);
      console.log(`Templates: ${listTemplates().map(cyan).join(", ")}`);
      console.log(yellow("Next steps:"));
      console.log(`  ${cyan(`cd ${name}`)}`);
      console.log(`  ${cyan("npm install")}`);
      console.log(`  ${cyan("npm run dev")}`);
    },
  );

await program.parseAsync(process.argv);
