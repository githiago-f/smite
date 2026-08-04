import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";
import { describe, expect, it } from "vitest";

const rootDir = fileURLToPath(new URL("../../../", import.meta.url));

const source = `
  import { specification, usecase, handler } from "@smitejs/domain";
  import { Result } from "@smitejs/fp";

  const active = specification({
    name: "active",
    predicate: (value) => (value === true ? Result.ok(true) : Result.err("inactive", {})),
  });

  const report = usecase({
    name: "report",
    handle: (_deps, input) =>
      active.isSatisfiedBy(input).isOk() ? Result.ok("yes") : Result.err("denied", {}),
  });

  export const run = async () => {
    const granted = await handler(report, {})({ body: true });
    const denied = await handler(report, {}, { errorStatus: 422 })({ body: false });
    return { granted, denied };
  };
`;

describe("runtime bundle", () => {
  it("drops the registry and still runs a usecase through a handler", async () => {
    const dir = mkdtempSync(join(tmpdir(), "smite-domain-"));
    const outfile = join(dir, "app.cjs");

    await esbuild.build({
      stdin: {
        contents: source,
        resolveDir: rootDir,
        sourcefile: "app.ts",
        loader: "ts",
      },
      bundle: true,
      platform: "node",
      format: "cjs",
      target: "es2022",
      outfile,
      define: { ALLOW_GLOBAL_REGISTRY: "false" },
      alias: {
        "@smitejs/core": join(rootDir, "packages/core/src/index.ts"),
        "@smitejs/fp": join(rootDir, "packages/fp/src/index.ts"),
        "@smitejs/domain": join(rootDir, "packages/domain/src/index.ts"),
      },
    });

    const bundle = readFileSync(outfile, "utf8");

    expect(bundle).not.toContain("globalRegistry");

    const { run } = await import(outfile);
    const { granted, denied } = await run();

    expect(granted).toEqual({ status: 200, body: "yes" });
    expect(denied.status).toBe(422);
  });
});
