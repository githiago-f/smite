import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { collectFiles } from "./snippets.mjs";

const rootDir = process.cwd();

describe("docs convention", () => {
  it("concept docs never contain raw TypeScript code fences", async () => {
    const files = await collectFiles(
      join(rootDir, "packages"),
      (filePath) =>
        filePath.endsWith(".md") && filePath.includes("/docs/concepts/"),
    );

    expect(files.length).toBeGreaterThan(0);
    const offenders: string[] = [];
    for (const filePath of files) {
      const source = await readFile(filePath, "utf8");
      if (/^\s*```\s*tsx?\s*$/gmu.test(source)) {
        offenders.push(filePath);
      }
    }
    expect(offenders).toEqual([]);
  });
});
