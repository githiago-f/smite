import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { expandExamples } from "../../../scripts/inject-jsdoc-examples.mjs";
import {
  collectFiles,
  collectTestSnippets,
} from "../../../scripts/snippets.mjs";

const packageName = "@smitejs/realtime";
const rootDir = process.cwd();
const srcDir = join(rootDir, "packages/realtime/src");

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
    const exampleTag = /^(\s*\*[^\S\r\n]*)@example[^\S\r\n]+([^\r\n]+?)\s*$/gmu;
    for (const match of source.matchAll(exampleTag)) {
      references.push({ filePath, title: match[2]?.trim() ?? "" });
    }
  }

  return { snippetIndex, references };
};

describe("documentation integrity", () => {
  it("every @example resolves to a tested #section snippet", async () => {
    const { snippetIndex, references } = await exampleReferences();
    const missing = references
      .filter(({ title }) => !snippetIndex.has(title.toLowerCase()))
      .map(
        ({ filePath, title }) =>
          `- Missing tested snippet "${title}" in ${filePath}`,
      );
    expect(missing).toEqual([]);
  });

  it("renders each referenced snippet into a code block", async () => {
    const { snippetIndex, snippets } = await collectTestSnippets({
      packageName,
      rootDir,
      srcDir,
    });
    for (const snippet of snippets) {
      const rendered = expandExamples(
        ` * @example ${snippet.title}\n`,
        snippetIndex,
        packageName,
        "synthetic.d.ts",
      );
      expect(rendered).toContain("```ts");
      expect(rendered).toContain(snippet.code.split("\n")[0]);
    }
  });
});
