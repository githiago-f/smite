import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  DevWatcher,
  bundleDevServer,
  collectWatchedFiles,
  spawnServer,
} from "./dev.js";
import { runAll } from "./plugins.js";
import type { SmitePlugin } from "./plugins.js";

const cwd = process.cwd().endsWith("/packages/cli")
  ? join(process.cwd(), "../..")
  : process.cwd();

const sourceAliases = {
  "@smite/core": join(cwd, "packages/core/src/index.ts"),
  "@smite/http": join(cwd, "packages/http/src/index.ts"),
  zod: join(cwd, "node_modules/zod/index.cjs"),
};

const entry = join(cwd, "packages/cli/test/app.ts");

const makeTempDir = async (): Promise<string> => {
  const dir = await mkdtemp(join(tmpdir(), "smite-cli-dev-"));
  return dir;
};

const closeProcess = (child: { kill: (signal: string) => unknown }) => {
  child.kill("SIGKILL");
};

describe("@smite/cli dev", () => {
  it("runs every configured plugin in order", async () => {
    const calls: string[] = [];
    const plugins: SmitePlugin[] = [
      { name: "first", run: () => calls.push("first") },
      { name: "second", run: () => calls.push("second") },
    ];
    // #section - Run all configured plugins
    await runAll(plugins, { apps: [] });
    // #endsection

    expect(calls).toEqual(["first", "second"]);
  });

  it("bundles a runtime dev server and serves the app", async () => {
    const dir = await makeTempDir();
    const outfile = join(dir, "dev-server.mjs");

    // #section - Bundle a dev server entry
    await bundleDevServer({
      cwd,
      entry,
      alias: sourceAliases,
      outfile,
    });
    // #endsection

    const bundle = await readFile(outfile, "utf8");
    expect(bundle).not.toContain("globalRegistry");
    await rm(dir, { recursive: true, force: true });
  });

  it("spawns a bundled dev server that answers HTTP requests", async () => {
    const dir = await makeTempDir();
    const outfile = join(dir, "dev-server.mjs");
    await bundleDevServer({
      cwd,
      entry,
      alias: sourceAliases,
      outfile,
    });

    const child = spawnServer(outfile, {
      cwd: dir,
      port: 0,
      host: "127.0.0.1",
      stdio: "pipe",
    });

    const base = await new Promise<string>((resolve, reject) => {
      let buffer = "";
      child.stdout?.on("data", (chunk: Buffer) => {
        buffer += chunk.toString("utf8");
        const match = /listening on (http:\/\/[^:]+:\d+)/u.exec(buffer);
        if (match !== null) {
          resolve(match[1] as string);
        }
      });
      child.once("error", reject);
    });

    try {
      const response = await fetch(`${base}/health`);
      expect(response.status).toBe(200);
      expect(await response.text()).toBe("ok");

      const items = await fetch(`${base}/users/42`);
      expect(items.status).toBe(200);
      expect(await items.json()).toEqual({ id: "42" });
    } finally {
      closeProcess(child);
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("collects sources while excluding generated artifacts", async () => {
    const dir = await makeTempDir();
    await mkdir(join(dir, "src"), { recursive: true });
    await writeFile(join(dir, "src/app.ts"), "export const app = 1;\n", "utf8");
    await writeFile(
      join(dir, "src/app.client.ts"),
      "export const client = 1;\n",
      "utf8",
    );
    await writeFile(join(dir, "src/routes.json"), "{}\n", "utf8");

    const files = await collectWatchedFiles({
      cwd: dir,
      configPath: "smite.config.ts",
      entries: ["./src/app.ts"],
    });

    expect(files).toEqual([
      join(dir, "smite.config.ts"),
      join(dir, "src/app.ts"),
      join(dir, "src/routes.json"),
    ]);
    await rm(dir, { recursive: true, force: true });
  });

  it("fires onChange when a watched file changes", async () => {
    const dir = await makeTempDir();
    await writeFile(join(dir, "file.txt"), "one\n", "utf8");

    const changed: string[] = [];
    // #section - Watch source files for changes
    const watcher = new DevWatcher({
      watch: async () => [join(dir, "file.txt")],
      intervalMs: 20,
      onChange: (paths) => changed.push(...paths),
    });
    await watcher.poll();
    // #endsection

    expect(changed).toEqual([]);

    await writeFile(join(dir, "file.txt"), "two\n", "utf8");
    await watcher.poll();
    expect(changed).toEqual([join(dir, "file.txt")]);
    await rm(dir, { recursive: true, force: true });
  });
});
