import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { expandExamples } from "../../../scripts/inject-jsdoc-examples.mjs";
import {
  collectFiles,
  collectTestSnippets,
} from "../../../scripts/snippets.mjs";

const packageName = "@smitejs/aws";
const rootDir = process.cwd();
const srcDir = join(rootDir, "packages/aws/src");

describe("documentation integrity", () => {
  it("every @example resolves to a tested #section snippet", async () => {
    const { snippetIndex } = await collectTestSnippets({
      packageName,
      rootDir,
      srcDir,
    });
    const files = await collectFiles(srcDir, (filePath) =>
      filePath.endsWith(".ts"),
    );
    const missing: string[] = [];
    for (const filePath of files) {
      const source = await readFile(filePath, "utf8");
      const exampleTag =
        /^(\s*\*[^\S\r\n]*)@example[^\S\r\n]+([^\r\n]+?)\s*$/gmu;
      for (const match of source.matchAll(exampleTag)) {
        const title = match[2]?.trim() ?? "";
        if (!snippetIndex.has(title.toLowerCase())) {
          missing.push(`- Missing tested snippet "${title}" in ${filePath}`);
        }
      }
    }
    expect(missing).toEqual([]);
  });

  it("renders referenced snippets as TypeScript blocks", async () => {
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
    }
  });
});
