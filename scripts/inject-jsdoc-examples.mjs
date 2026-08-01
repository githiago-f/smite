import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { collectPublishableWorkspaces } from "./release-workspaces.mjs";
import {
  collectFiles,
  collectTestSnippets,
  normalizeExampleName,
} from "./snippets.mjs";

const rootDir = process.cwd();

const expandExamples = (source, snippetIndex, packageName, filePath) => {
  const unresolved = [];
  const expanded = source.replace(
    /^(\s*\*[^\S\r\n]*)@example[^\S\r\n]+([^\r\n]+?)\s*$/gmu,
    (line, prefix, title) => {
      const snippet = snippetIndex.get(normalizeExampleName(title));

      if (!snippet) {
        unresolved.push(title);
        return line;
      }

      if (snippet.code.includes("*/")) {
        throw new Error(
          [
            `Cannot expand @example "${title}" in ${filePath} (${packageName}).`,
            'The snippet code contains "*/", which would close the JSDoc',
            "comment early and corrupt the emitted declaration.",
            'Rewrite the snippet to avoid "*/" (e.g. a cron schedule without',
            'a "*/" step) before releasing.',
          ].join("\n"),
        );
      }

      return renderExample(prefix, snippet.code);
    },
  );

  if (unresolved.length > 0) {
    throw new Error(
      [
        `Cannot expand @example references in ${filePath} (${packageName}).`,
        ...unresolved.map((title) => `- Missing tested snippet: ${title}`),
      ].join("\n"),
    );
  }

  return expanded;
};

const renderExample = (prefix, code) =>
  [
    `${prefix}@example`,
    `${prefix}\`\`\`ts`,
    ...code.split("\n").map((line) => `${prefix}${line}`),
    `${prefix}\`\`\``,
  ].join("\n");

const main = async () => {
  const workspaces = await collectPublishableWorkspaces();

  for (const workspace of workspaces) {
    const srcDir = path.join(workspace.dir, "src");
    const distDir = path.join(workspace.dir, "dist");
    const { snippetIndex } = await collectTestSnippets({
      packageName: workspace.packageJson.name,
      rootDir,
      srcDir,
    });
    const files = await collectFiles(
      distDir,
      (filePath) => filePath.endsWith(".d.ts") || filePath.endsWith(".js"),
    );

    for (const filePath of files) {
      const source = await readFile(filePath, "utf8");
      const expanded = expandExamples(
        source,
        snippetIndex,
        workspace.packageJson.name,
        path.relative(rootDir, filePath),
      );

      if (expanded !== source) {
        await writeFile(filePath, expanded);
      }
    }
  }
};

await main();
