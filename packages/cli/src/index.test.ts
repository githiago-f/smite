import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { client } from "@smite/client";
import { childrenOf, clear } from "@smite/core";
import { http } from "@smite/http";
import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { build, bundleBuildEntries } from "./build.js";
import { compileApp, compileApps } from "./compile.js";
import {
  buildEntriesOf,
  defineSmiteConfig,
  entriesOf,
  loadConfig,
} from "./config.js";
import { createApp, listTemplates } from "./create.js";
import { dispatch } from "./plugins.js";
import type { SmitePlugin } from "./plugins.js";

const cwd = process.cwd().endsWith("/packages/cli")
  ? join(process.cwd(), "../..")
  : process.cwd();

const entry = join(cwd, "packages/cli/test/app.ts");

const sourceAliases = {
  "@smite/core": join(cwd, "packages/core/src/index.ts"),
  "@smite/http": join(cwd, "packages/http/src/index.ts"),
  zod: join(cwd, "node_modules/zod/index.cjs"),
};

const configAliases = {
  "@smite/core": join(cwd, "packages/core/src/index.ts"),
  "@smite/cli": join(cwd, "packages/cli/src/index.ts"),
  "@smite/client": join(cwd, "packages/client/src/index.ts"),
  "@smite/http": join(cwd, "packages/http/src/index.ts"),
  "@smite/openapi": join(cwd, "packages/openapi/src/index.ts"),
};

const buildAliases = {
  ...configAliases,
  "@smite/cli": join(cwd, "packages/cli/src/config.ts"),
  zod: join(cwd, "node_modules/zod/index.cjs"),
};

afterEach(() => clear());

describe("@smite/cli", () => {
  it("defines a first HTTP app", () => {
    // #section - Define a first HTTP app
    const app = http.app("hello");
    const route = http.route(app).req({
      query: z.object({ name: z.string().optional() }).partial(),
    });
    route.accept("GET", "/hello").handler((ctx) => ({
      status: 200,
      body: { message: `Hello, ${ctx.query.name ?? "world"}!` },
    }));
    // #endsection

    expect(childrenOf(app, "http.route")).toHaveLength(1);
  });

  it("configures the client plugin", () => {
    // #section - Configure the client plugin
    const config = {
      entries: ["./src/app.ts"],
      plugins: [client({ outfile: "./src/app.client.ts" })],
    };
    // #endsection

    expect(config.plugins[0]?.name).toBe("client");
  });

  it("compiles an app entry and locates the app node", async () => {
    // #section - Compile an app entry
    const app = await compileApp({ entry, alias: sourceAliases });
    // #endsection

    expect(app.__kind).toBe("app");
    expect(childrenOf(app, "http.route")).toHaveLength(1);
  });

  it("compiles multiple app entries into a deduplicated union", async () => {
    // #section - Compile multiple app entries
    const apps = await compileApps({
      entries: [entry, join(cwd, "packages/cli/test/admin.ts")],
      alias: sourceAliases,
    });
    // #endsection

    expect(apps.map((app) => app.__key).sort()).toEqual([
      "admin",
      "cli-fixture",
    ]);
  });

  it("defines a Smite config", () => {
    // #section - Define a Smite config
    const config = defineSmiteConfig({
      entry: "./src/app.ts",
      plugins: [],
    });
    // #endsection

    expect(config.entry).toBe("./src/app.ts");
    expect(config.plugins).toEqual([]);
  });

  it("resolves build entries from build config or app entries", () => {
    expect(
      buildEntriesOf({
        entries: ["./src/app.ts"],
        plugins: [],
      }),
    ).toEqual(["./src/app.ts"]);

    expect(
      buildEntriesOf({
        entry: "./src/app.ts",
        plugins: [],
        build: { entry: "./src/server.ts" },
      }),
    ).toEqual(["./src/server.ts"]);

    expect(
      buildEntriesOf({
        entry: "./src/app.ts",
        plugins: [],
        build: { entries: ["./src/api.ts", "./src/jobs.ts"] },
      }),
    ).toEqual(["./src/api.ts", "./src/jobs.ts"]);
  });

  it("loads a config and reads its default export", async () => {
    const dir = await mkdtemp(join(tmpdir(), "smite-cli-config-"));
    const configPath = join(dir, "smite.config.ts");
    const configSource = `import { defineSmiteConfig } from "@smite/cli";
import { client } from "@smite/client";

export default defineSmiteConfig({
  entry: ${JSON.stringify(entry)},
  plugins: [client({ outfile: "app.client.ts" })],
});
`;
    await writeFile(configPath, configSource, "utf8");

    // #section - Load a Smite config
    const config = await loadConfig(configPath, configAliases);
    // #endsection

    expect(config.entry).toBe(entry);
    expect(config.plugins).toHaveLength(1);
    expect(config.plugins[0]?.name).toBe("client");
    await rm(dir, { recursive: true, force: true });
  });

  it("dispatches to the plugin matching a name", async () => {
    const app = await compileApp({ entry, alias: sourceAliases });
    const plugin: SmitePlugin = {
      name: "client",
      run: ({ apps: nodes }) => {
        expect(nodes.map((node) => node.__kind)).toEqual(["app"]);
      },
    };
    // #section - Dispatch a plugin by name
    await dispatch([plugin], "client", { apps: [app] });
    // #endsection
  });

  it("rejects an unknown plugin name", async () => {
    const app = await compileApp({ entry, alias: sourceAliases });
    await expect(dispatch([], "nope", { apps: [app] })).rejects.toThrow(
      /Unknown plugin 'nope'. Available:/,
    );
  });

  it("rejects duplicate plugin names", async () => {
    const app = await compileApp({ entry, alias: sourceAliases });
    const plugin: SmitePlugin = { name: "dup", run: () => {} };
    await expect(
      dispatch([plugin, plugin], "dup", { apps: [app] }),
    ).rejects.toThrow(/Duplicate plugin name 'dup'/);
  });

  it("runs the client plugin end-to-end through the config", async () => {
    const dir = await mkdtemp(join(tmpdir(), "smite-cli-e2e-"));
    const configPath = join(dir, "smite.config.ts");
    const outfile = join(dir, "app.client.ts");
    const configSource = `import { defineSmiteConfig } from "@smite/cli";
import { client } from "@smite/client";

export default defineSmiteConfig({
  entry: ${JSON.stringify(entry)},
  plugins: [client({ outfile: ${JSON.stringify(outfile)} })],
});
`;
    await writeFile(configPath, configSource, "utf8");

    const config = await loadConfig(configPath, configAliases);
    const apps = await compileApps({
      entries: entriesOf(config),
      alias: sourceAliases,
    });
    await dispatch(config.plugins, "client", { apps });

    const code = await readFile(outfile, "utf8");
    expect(code).toContain("users");
    expect(code).toContain('request("GET", "/users/:id"');
    await rm(dir, { recursive: true, force: true });
  });

  it("bundles runtime entries with descriptor collection disabled", async () => {
    const dir = await mkdtemp(join(tmpdir(), "smite-cli-build-"));
    await writeFile(
      join(dir, "server.ts"),
      `import { app } from ${JSON.stringify(entry)};
export default app;
`,
      "utf8",
    );

    // #section - Bundle runtime entries
    const [outfile] = await bundleBuildEntries({
      cwd: dir,
      entries: ["./server.ts"],
      outdir: "dist",
      alias: sourceAliases,
    });
    // #endsection

    expect(outfile).toBe(join(dir, "dist/server.mjs"));
    const bundle = await readFile(outfile ?? "", "utf8");
    expect(bundle).not.toContain("globalRegistry");
    await rm(dir, { recursive: true, force: true });
  });

  it("runs generators before bundling runtime entries", async () => {
    const dir = await mkdtemp(join(tmpdir(), "smite-cli-build-"));
    await mkdir(join(dir, "node_modules"), { recursive: true });
    const configPath = join(dir, "smite.config.ts");
    const marker = join(dir, "generated.txt");
    await writeFile(
      join(dir, "server.ts"),
      `import { app } from ${JSON.stringify(entry)};
export { app };
`,
      "utf8",
    );
    await writeFile(
      configPath,
      `import { writeFile } from "node:fs/promises";

export default {
  entry: ${JSON.stringify(entry)},
  build: { entry: "./server.ts", outdir: "./dist" },
  plugins: [{
    name: "marker",
    run: async () => writeFile(${JSON.stringify(marker)}, "generated", "utf8"),
  }],
};
`,
      "utf8",
    );

    const previousCwd = process.cwd();
    process.chdir(dir);
    try {
      const outfiles = await build({
        config: configPath,
        alias: buildAliases,
      });
      expect(outfiles).toEqual([join(dir, "dist/server.mjs")]);
    } finally {
      process.chdir(previousCwd);
    }

    expect(await readFile(marker, "utf8")).toBe("generated");
    const bundle = await readFile(join(dir, "dist/server.mjs"), "utf8");
    expect(bundle).not.toContain("globalRegistry");
    await rm(dir, { recursive: true, force: true });
  });

  it("errors when no app is registered", async () => {
    const empty = join(cwd, "packages/client/test/empty.ts");
    await expect(
      compileApp({ entry: empty, alias: sourceAliases }),
    ).rejects.toThrow(/No app found/);
  });

  it("scaffolds an application and generates a client from it", async () => {
    const dir = await mkdtemp(join(tmpdir(), "smite-cli-create-"));
    // #section - Scaffold a new application
    const appDir = await createApp({ name: "demo-app", baseDir: dir });
    // #endsection

    const configPath = join(appDir, "smite.config.ts");
    const configSource = await readFile(configPath, "utf8");
    expect(configSource).toContain("client({ outfile");
    expect(configSource).toContain("openapi({ outfile");

    const appSource = await readFile(join(appDir, "src/app.ts"), "utf8");
    expect(appSource).toContain("http.app");

    const serverSource = await readFile(join(appDir, "src/server.ts"), "utf8");
    expect(serverSource).toContain("serveNode");
    expect(serverSource).toContain('from "./app.ts"');

    const tsconfigSource = await readFile(
      join(appDir, "tsconfig.json"),
      "utf8",
    );
    expect(tsconfigSource).toContain("NodeNext");
    expect(tsconfigSource).toContain("allowImportingTsExtensions");

    const config = await loadConfig(configPath, configAliases);

    const previousCwd = process.cwd();
    process.chdir(appDir);
    try {
      const apps = await compileApps({
        entries: entriesOf(config),
        alias: sourceAliases,
      });
      expect(apps).toHaveLength(1);
      const appNode = apps[0];
      if (appNode !== undefined) {
        expect(childrenOf(appNode, "http.route")).toHaveLength(1);
      }

      await dispatch(config.plugins, "client", { apps });
      await dispatch(config.plugins, "openapi", { apps });
    } finally {
      process.chdir(previousCwd);
    }

    const clientCode = await readFile(
      join(appDir, "src/app.client.ts"),
      "utf8",
    );
    expect(clientCode).toContain("items");
    expect(clientCode).toContain('request("GET", "/items/:id"');

    const openapiDoc = JSON.parse(
      await readFile(join(appDir, "openapi.json"), "utf8"),
    ) as { paths: Record<string, unknown> };
    expect(openapiDoc.paths["/items/{id}"]).toBeDefined();

    await rm(dir, { recursive: true, force: true });
  });

  it("refuses to overwrite an existing directory unless forced", async () => {
    const dir = await mkdtemp(join(tmpdir(), "smite-cli-create-"));
    await createApp({ name: "demo", baseDir: dir });
    await expect(createApp({ name: "demo", baseDir: dir })).rejects.toThrow(
      /already exists/,
    );

    await createApp({ name: "demo", baseDir: dir, force: true });
    await rm(dir, { recursive: true, force: true });
  });

  it("lists the starter templates", () => {
    // #section - List the starter templates
    const templates = listTemplates();
    // #endsection

    expect(templates).toEqual(["default", "minimal"]);
  });

  it("scaffolds the minimal template without a server or openapi", async () => {
    const dir = await mkdtemp(join(tmpdir(), "smite-cli-create-"));
    const appDir = await createApp({
      name: "minimal-app",
      baseDir: dir,
      template: "minimal",
    });

    const configSource = await readFile(
      join(appDir, "smite.config.ts"),
      "utf8",
    );
    expect(configSource).toContain("client({ outfile");
    expect(configSource).not.toContain("openapi");

    const serverExists = (await readdir(join(appDir, "src"))).includes(
      "server.ts",
    );
    expect(serverExists).toBe(false);

    await expect(
      createApp({ name: "nope", baseDir: dir, template: "bogus" }),
    ).rejects.toThrow(/Unknown template 'bogus'/);
    await rm(dir, { recursive: true, force: true });
  });
});
