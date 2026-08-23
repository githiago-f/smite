import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "@smitejs/cli";
import { afterEach, describe, expect, it } from "vitest";

const baseDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    baseDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
  );
});

describe("create-smite-app", () => {
  it("scaffolds a default template application", async () => {
    const baseDir = await mkdtemp(join(tmpdir(), "create-smite-app-default-"));
    baseDirs.push(baseDir);
    // #section - Scaffold a new application
    const dir = await createApp({ name: "demo-app", baseDir });
    // #endsection

    expect(dir).toBe(join(baseDir, "demo-app"));
    const config = await readFile(join(dir, "smite.config.ts"), "utf8");
    expect(config).toContain("openapi({ outfile");
    const server = await readFile(join(dir, "src/server.ts"), "utf8");
    expect(server).toContain("serveNode");
    expect(server).toContain("swaggerUi");
    const pkg = await readFile(join(dir, "package.json"), "utf8");
    expect(pkg).toContain('"dev": "smite dev"');
  });

  it("scaffolds the serverless template without a node server", async () => {
    const baseDir = await mkdtemp(
      join(tmpdir(), "create-smite-app-serverless-"),
    );
    baseDirs.push(baseDir);
    const dir = await createApp({
      name: "serverless-app",
      baseDir,
      template: "serverless",
    });

    const config = await readFile(join(dir, "smite.config.ts"), "utf8");
    expect(config).toContain('entry: "./src/handler.ts"');
    expect(config).toContain("serverless({");
    expect(config).not.toContain("openapi");
    const pkg = await readFile(join(dir, "package.json"), "utf8");
    expect(pkg).not.toContain("@smitejs/openapi");
  });
});
