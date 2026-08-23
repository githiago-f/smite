import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import {
  collectFiles,
  collectTestSnippets,
  expandExamples,
} from "@smitejs/snippets";
import { collectPublishableWorkspaces } from "./release-workspaces.mjs";

export { expandExamples } from "@smitejs/snippets";

const rootDir = process.cwd();

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

if (
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  await main();
}
