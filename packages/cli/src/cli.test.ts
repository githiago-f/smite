import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("@smite/cli bin", () => {
  it("registers the dev command", async () => {
    const source = await readFile(new URL("./cli.ts", import.meta.url), "utf8");

    expect(source).toContain('.command("dev")');
    expect(source).toContain("await dev({");
  });
});
