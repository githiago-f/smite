import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { expandExamples } from "./expand.js";
import { collectFiles } from "./snippets.js";
import type { Snippet } from "./snippets.js";

/**
 * Walks `targetDir` for `.d.ts`/`.js`/`.ts` files and expands `@example`
 * declarations in place against the snippet index. Returns the written paths.
 *
 * @group Inline
 */
export const injectIntoFiles = async (input: {
  readonly targetDir: string;
  readonly snippetIndex: ReadonlyMap<string, Snippet>;
  readonly packageName: string;
}): Promise<readonly string[]> => {
  const files = await collectFiles(
    input.targetDir,
    (filePath) =>
      filePath.endsWith(".d.ts") ||
      filePath.endsWith(".js") ||
      filePath.endsWith(".ts"),
  );
  const written: string[] = [];

  for (const filePath of files) {
    const source = await readFile(filePath, "utf8");
    const expanded = expandExamples(
      source,
      input.snippetIndex,
      input.packageName,
      filePath,
    );

    if (expanded !== source) {
      await writeFile(filePath, expanded);
      written.push(filePath);
    }
  }

  return written;
};

/** Default target directory when none is supplied to the inject command. */
export const DEFAULT_INJECT_TARGET = join("dist");
