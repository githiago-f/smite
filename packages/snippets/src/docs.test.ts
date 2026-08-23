import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  collectFiles,
  collectTestSnippets,
  expandExamples,
  normalizeExampleName,
} from "./index.js";

const packageName = "@smitejs/snippets";
const rootDir = process.cwd();
const srcDir = join(rootDir, "packages/snippets/src");

const exampleReferences = async () => {
  const { snippetIndex } = await collectTestSnippets({
    packageName,
    rootDir,
    srcDir,
  });
  const files = await collectFiles(srcDir, (filePath) =>
    filePath.endsWith(".ts"),
  );
  const references: Array<{ filePath: string; title: string }> = [];

  for (const filePath of files) {
    const source = await readFile(filePath, "utf8");

    for (const match of source.matchAll(
      /^(\s*\*[^\S\r\n]*)@example[^\S\r\n]+([^\r\n]+?)\s*$/gmu,
    )) {
      references.push({ filePath, title: match[2]?.trim() ?? "" });
    }
  }

  return { snippetIndex, references };
};

describe("documentation integrity", () => {
  it("every @example resolves to a tested #section snippet", async () => {
    const { snippetIndex, references } = await exampleReferences();
    const missing = references
      .filter(({ title }) => !snippetIndex.has(normalizeExampleName(title)))
      .map(
        ({ filePath, title }) =>
          `- Missing tested snippet "${title}" in ${filePath}`,
      );
    expect(missing).toEqual([]);
  });

  it("renders each referenced snippet into a code block", async () => {
    const { snippetIndex } = await collectTestSnippets({
      packageName,
      rootDir,
      srcDir,
    });

    for (const title of snippetIndex.keys()) {
      const rendered = expandExamples(
        ` * @example ${title}\n`,
        snippetIndex,
        packageName,
        "synthetic.d.ts",
      );
      expect(rendered).toContain("```ts");
    }
  });
});
