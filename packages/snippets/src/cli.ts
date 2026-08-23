#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import process from "node:process";
import { Command } from "commander";
import { expandTemplate } from "./expand.js";
import { injectIntoFiles } from "./inject.js";
import {
  buildSnippetIndex,
  collectFiles,
  collectTestSnippets,
} from "./snippets.js";
import type { Snippet } from "./snippets.js";

const program = new Command();
const colorEnabled =
  process.stdout.isTTY === true && process.env.NO_COLOR === undefined;
const paint =
  (code: number) =>
  (text: string): string =>
    colorEnabled ? `\u001b[${code}m${text}\u001b[0m` : text;
const green = paint(32);
const cyan = paint(36);
const red = paint(31);

const collectFor = async (src: string, packageName: string) => {
  const { snippetIndex } = await collectTestSnippets({
    packageName,
    rootDir: process.cwd(),
    srcDir: resolve(process.cwd(), src),
  });
  return snippetIndex;
};

const loadIndex = async (
  file: string,
): Promise<ReadonlyMap<string, Snippet>> => {
  const raw = JSON.parse(await readFile(resolve(process.cwd(), file), "utf8"));
  return buildSnippetIndex(raw as Snippet[], "index");
};

program
  .name("smite-snippets")
  .description(
    "Generate docs, JSDoc examples, and code from tested #section snippets.",
  )
  .version("0.1.0");

program
  .command("index")
  .description(
    "Collect tested snippets from a package's src test files as JSON",
  )
  .argument("<src>", "package source directory holding *.test.ts files")
  .requiredOption("--package <name>", "package name used in error messages")
  .action(async (src: string, options: { package: string }) => {
    const { snippets } = await collectTestSnippets({
      packageName: options.package,
      rootDir: process.cwd(),
      srcDir: resolve(process.cwd(), src),
    });
    process.stdout.write(`${JSON.stringify(snippets, null, 2)}\n`);
  });

program
  .command("inject")
  .description(
    "Expand @example JSDoc references in declaration/source files in place",
  )
  .argument("<src>", "package source directory holding *.test.ts files")
  .argument("<target>", "directory to expand @example into, defaults to ./dist")
  .requiredOption("--package <name>", "package name used in error messages")
  .action(async (src: string, target: string, options: { package: string }) => {
    const snippetIndex = await collectFor(src, options.package);
    const written = await injectIntoFiles({
      targetDir: resolve(process.cwd(), target),
      snippetIndex,
      packageName: options.package,
    });
    for (const filePath of written) {
      console.log(`${green("Injected")} ${cyan(filePath)}`);
    }
  });

program
  .command("template")
  .description(
    "Expand // @snippet markers in a template tree into an output directory",
  )
  .argument("<src>", "template directory (files may carry // @snippet markers)")
  .argument("<out>", "output directory for the expanded tree")
  .requiredOption(
    "--index <file>",
    "JSON snippet index produced by `smite-snippets index`",
  )
  .action(async (src: string, out: string, options: { index: string }) => {
    const snippetIndex = await loadIndex(options.index);
    const sourceDir = resolve(process.cwd(), src);
    const outDir = resolve(process.cwd(), out);
    const files = await collectFiles(sourceDir, () => true);

    for (const filePath of files) {
      const source = await readFile(filePath, "utf8");
      const relativePath = filePath.slice(sourceDir.length + 1);
      const expanded = expandTemplate(
        source,
        snippetIndex,
        "template",
        relativePath,
      );
      const targetPath = join(outDir, relativePath);
      await mkdir(dirname(targetPath), { recursive: true });
      await writeFile(targetPath, expanded);
    }
  });

try {
  await program.parseAsync(process.argv);
} catch (error) {
  console.error(red(error instanceof Error ? error.message : String(error)));
  process.exitCode = 1;
}
