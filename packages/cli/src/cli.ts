#!/usr/bin/env node
import { Command } from "commander";
import { build } from "./build.js";
import { collectCommands, runCommand } from "./commands.js";
import { appsOf, compileAppEntries } from "./compile.js";
import {
  buildEntriesOf,
  cliEntriesOf,
  entriesOf,
  loadConfig,
} from "./config.js";
import { createApp } from "./create.js";
import type { CreateTemplate } from "./create.js";
import { dev } from "./dev.js";
import { deploy, dispatch, runAll } from "./plugins.js";

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
const red = paint(31);

program
  .name("smite")
  .description("Compile-time toolchain for Smite apps.")
  .version("0.1.0");

program
  .command("create <name>")
  .description("Scaffold a new Smite application into ./<name>")
  .option(
    "--template <template>",
    "starter template (http | serverless)",
    "http",
  )
  .option("--force", "overwrite an existing directory")
  .action(
    async (name: string, options: { template?: string; force?: boolean }) => {
      const dir = await createApp({
        name,
        ...(options.template === undefined
          ? {}
          : { template: options.template as CreateTemplate }),
        ...(options.force === true ? { force: true } : {}),
      });
      console.log(`${green("Scaffolded")} ${cyan(dir)}`);
      console.log(yellow("Next steps:"));
      console.log(`  ${cyan(`cd ${name}`)}`);
      console.log(`  ${cyan("npm install")}`);
      console.log(`  ${cyan("npm run dev")}`);
    },
  );

program
  .command("list")
  .description("List the generator plugins declared in smite.config.ts")
  .option("--config <path>", "path to the config file", "smite.config.ts")
  .action(async (options: { config: string }) => {
    const config = await loadConfig(options.config);
    for (const plugin of config.plugins) {
      console.log(cyan(plugin.name));
    }
  });

program
  .command("dev")
  .description(
    "Run generators, serve the app locally, and auto-reload on change",
  )
  .option("--config <path>", "path to the config file", "smite.config.ts")
  .option("--port <number>", "port to listen on")
  .option("--host <host>", "host to bind", "127.0.0.1")
  .option("--no-watch", "serve once without watching")
  .action(
    async (options: {
      config: string;
      port?: string;
      host: string;
      watch: boolean;
    }) => {
      await dev({
        config: options.config,
        ...(options.port === undefined ? {} : { port: Number(options.port) }),
        host: options.host,
        watch: options.watch,
      });
    },
  );

program
  .command("build")
  .description("Run generators and bundle runtime entries for deployment")
  .option("--config <path>", "path to the config file", "smite.config.ts")
  .action(async (options: { config: string }) => {
    const outfiles = await build({ config: options.config });
    for (const outfile of outfiles) {
      console.log(`${green("Built")} ${cyan(outfile)}`);
    }
  });

program
  .command("deploy <plugin>")
  .description(
    "Generate provider artifacts and deploy through a provider plugin",
  )
  .option("--config <path>", "path to the config file", "smite.config.ts")
  .action(async (plugin: string, options: { config: string }) => {
    const config = await loadConfig(options.config);
    const compiledEntries = await compileAppEntries({
      entries: entriesOf(config),
      ...(config.alias === undefined ? {} : { alias: config.alias }),
    });
    const apps = appsOf(compiledEntries);
    await runAll(config.plugins, {
      apps,
      entries: entriesOf(config),
      buildEntries: buildEntriesOf(config),
      compiledEntries,
      ...(config.build === undefined ? {} : { build: config.build }),
    });
    await deploy(config.plugins, plugin);
    console.log(`${green("Deployed")} ${cyan(plugin)}`);
  });

program
  .command("generate <plugin>")
  .description("Run a generator plugin against the compiled app")
  .option("--config <path>", "path to the config file", "smite.config.ts")
  .option("--app-name <name>", "disambiguate when several apps are declared")
  .action(
    async (plugin: string, options: { config: string; appName?: string }) => {
      const config = await loadConfig(options.config);
      const entries = entriesOf(config);
      const compiledEntries = await compileAppEntries({
        entries,
        ...(config.alias === undefined ? {} : { alias: config.alias }),
      });
      const apps = appsOf(compiledEntries);
      const appName = options.appName ?? config.appName;
      const selected =
        appName === undefined
          ? apps
          : apps.filter((app) => app.__key === appName);
      if (appName !== undefined && selected.length === 0) {
        throw new Error(
          `App '${appName}' was not found in the registry. Available: ${apps
            .map((app) => app.__key)
            .join(", ")}.`,
        );
      }
      await dispatch(config.plugins, plugin, {
        apps: selected,
        entries,
        buildEntries: buildEntriesOf(config),
        compiledEntries,
        ...(config.build === undefined ? {} : { build: config.build }),
      });
    },
  );

program
  .command("run <command>")
  .description("Run a local command registered with cli.exe")
  .option("--config <path>", "path to the config file", "smite.config.ts")
  .action(async (command: string, options: { config: string }) => {
    const config = await loadConfig(options.config);
    const entries = cliEntriesOf(config);
    const compiledEntries = await compileAppEntries({
      entries,
      ...(config.alias === undefined ? {} : { alias: config.alias }),
    });
    const apps = appsOf(compiledEntries);
    const commands = collectCommands(compiledEntries);
    await runCommand(commands, command, { apps, entries, compiledEntries });
    console.log(`${green("Ran")} ${cyan(command)}`);
  });

try {
  await program.parseAsync(process.argv);
} catch (error) {
  console.error(red(error instanceof Error ? error.message : String(error)));
  process.exitCode = 1;
}
