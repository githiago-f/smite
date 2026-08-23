import { spawn } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import type { Dirent } from "node:fs";
import { mkdir, readdir, stat } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { clear } from "@smitejs/core";
import * as esbuild from "esbuild";
import { appsOf, compileAppEntries } from "./compile.js";
import { buildEntriesOf, entriesOf, loadConfig } from "./config.js";
import { runAll } from "./plugins.js";

/**
 * Options for {@link dev}.
 *
 * @group Dev
 */
export interface DevOptions {
  /** Path to the config file. Defaults to `smite.config.ts`. */
  readonly config?: string;
  /** Port the dev server listens on. Defaults to `process.env.PORT` or `3000`. */
  readonly port?: number;
  /** Host the dev server binds. Defaults to `process.env.HOST` or `127.0.0.1`. */
  readonly host?: string;
  /** Re-run generators and restart the server on change. Defaults to `true`. */
  readonly watch?: boolean;
  /** Monorepo aliases passed to the entry bundle. */
  readonly alias?: Readonly<Record<string, string>>;
  /** Abort the running dev server when signalled (used by tests). */
  readonly signal?: AbortSignal;
}

const canResolve = (id: string, fromDir: string): boolean => {
  try {
    createRequire(join(fromDir, "noop.js")).resolve(id);
    return true;
  } catch {
    return false;
  }
};

const DEV_DIR = join("node_modules", ".smite");
const DEV_OUTFILE = join(DEV_DIR, "dev-server.cjs");

const generatedServerEntry = (options: {
  readonly entry: string;
  readonly docs: boolean;
  readonly title: string;
  readonly openapiJson: string;
}): string => `
import { serveNode } from "@smitejs/http";
import * as mod from ${JSON.stringify(options.entry)};
${options.docs ? `import { swaggerUiFromFile } from "@smitejs/openapi";` : ""}

const app = mod.app ?? mod["default"];

${
  options.docs
    ? `
const docs = {
  router: swaggerUiFromFile({ file: ${JSON.stringify(options.openapiJson)}, title: ${JSON.stringify(options.title)} }),
  paths: ["/docs", "/openapi.json"],
};`
    : "const docs = undefined;"
}

const server = serveNode(app, docs === undefined ? {} : { docs });
const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? "127.0.0.1";
server.listen(port, host, () => {
  const address = server.address();
  const actualPort = typeof address === "object" && address !== null ? address.port : port;
  console.log(\`dev server listening on http://\${host}:\${actualPort}\`);
  if (docs !== undefined) {
    console.log(\`- API docs:     http://\${host}:\${actualPort}/docs\`);
    console.log(\`- OpenAPI spec: http://\${host}:\${actualPort}/openapi.json\`);
  }
});
`;

/**
 * Options for {@link bundleDevServer}.
 *
 * @group Dev
 */
export interface BundleDevServerOptions {
  /** The working directory the user app resolves from. */
  readonly cwd: string;
  /** The app entry exporting `app` (or `default`). */
  readonly entry: string;
  /** Monorepo aliases passed to the bundle. */
  readonly alias?: Readonly<Record<string, string>>;
  /** Mount Swagger UI and `/openapi.json` when `@smitejs/openapi` is present. */
  readonly docs?: boolean;
  /** Title for the docs page. */
  readonly title?: string;
  /** Where to write the runtime bundle. */
  readonly outfile: string;
}

/**
 * Bundles a self-contained dev server in runtime mode
 * (`ALLOW_GLOBAL_REGISTRY` folded to `false`) from a generated entry that
 * imports the user's app and serves it over `node:http`. Returns `outfile`.
 *
 * The CLI never imports `@smitejs/http` itself; esbuild resolves it from the
 * user's installed packages at bundle time.
 *
 * @group Dev
 * @example Bundle a dev server entry
 */
export async function bundleDevServer(
  options: BundleDevServerOptions,
): Promise<string> {
  const { cwd, entry, alias, docs, title, outfile } = options;
  const contents = generatedServerEntry({
    entry: resolve(cwd, entry),
    docs: docs === true,
    title: title ?? "Smite API",
    openapiJson: resolve(cwd, "openapi.json"),
  });

  await mkdir(dirname(outfile), { recursive: true });
  await esbuild.build({
    stdin: {
      contents,
      resolveDir: cwd,
      sourcefile: "dev-server.ts",
      loader: "ts",
    },
    bundle: true,
    platform: "node",
    format: "cjs",
    mainFields: ["module", "main"],
    target: "es2022",
    define: { ALLOW_GLOBAL_REGISTRY: "false" },
    outfile,
    absWorkingDir: cwd,
    logOverride: { "import-is-undefined": "silent" },
    external: ["esbuild", "commander"],
    ...(alias === undefined ? {} : { alias }),
  });
  return outfile;
}

/**
 * Options for {@link spawnServer}.
 *
 * @group Dev
 */
export interface SpawnServerOptions {
  readonly cwd: string;
  readonly port: number;
  readonly host: string;
  /** Child stdio mode. Defaults to `"inherit"` so logs stream to the terminal. */
  readonly stdio?: "inherit" | "pipe";
}

/**
 * Spawns a bundled dev server as a child `node` process with `PORT`/`HOST` in
 * its environment. The child's output is inherited by default so logs stream
 * to the terminal; pass `stdio: "pipe"` to capture them.
 *
 * @group Dev
 */
export function spawnServer(
  outfile: string,
  options: SpawnServerOptions,
): ChildProcess {
  return spawn(process.execPath, [outfile], {
    cwd: options.cwd,
    env: {
      ...process.env,
      PORT: String(options.port),
      HOST: options.host,
    },
    stdio: options.stdio ?? "inherit",
  });
}

const IGNORED_DIRS = new Set([
  "node_modules",
  "dist",
  ".git",
  ".smite",
  "coverage",
]);

const isGenerated = (name: string): boolean =>
  name === "openapi.json" || name.endsWith(".client.ts");

const paint =
  (stream: NodeJS.WriteStream, code: number) =>
  (text: string): string =>
    stream.isTTY === true && process.env.NO_COLOR === undefined
      ? `\u001b[${code}m${text}\u001b[0m`
      : text;
const green = paint(process.stdout, 32);
const red = paint(process.stderr, 31);
const cyan = paint(process.stdout, 36);

const report = (
  level: "info" | "error",
  message: string,
  data?: Readonly<Record<string, unknown>>,
): void => {
  const formattedMessage =
    level === "error"
      ? red(message)
      : message.replace(/^Generated/u, green("Generated"));
  if (data === undefined) {
    console[level === "error" ? "error" : "log"](formattedMessage);
  } else {
    const formattedData =
      level === "error" ? JSON.stringify(data) : cyan(JSON.stringify(data));
    console[level === "error" ? "error" : "log"](
      `${formattedMessage} ${formattedData}`,
    );
  }
};

const collectFiles = async (
  directory: string,
  out: Set<string>,
): Promise<void> => {
  let entries: Dirent[];
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (!IGNORED_DIRS.has(entry.name)) {
        await collectFiles(join(directory, entry.name), out);
      }
    } else if (
      !isGenerated(entry.name) &&
      /\.(?:ts|mjs|js|json)$/u.test(entry.name)
    ) {
      out.add(join(directory, entry.name));
    }
  }
};

/**
 * Options for {@link collectWatchedFiles}.
 *
 * @group Dev
 */
export interface CollectWatchedFilesOptions {
  readonly cwd: string;
  readonly configPath: string;
  readonly entries: readonly string[];
}

/**
 * The files `smite dev` watches: the config plus every `.ts`/`.mjs`/`.json`
 * source under each entry's directory, excluding generated artifacts
 * (`*.client.ts`, `openapi.json`) and build/install directories so
 * regeneration never re-triggers a rebuild.
 *
 * @group Dev
 */
export async function collectWatchedFiles(
  options: CollectWatchedFilesOptions,
): Promise<string[]> {
  const files = new Set<string>([resolve(options.cwd, options.configPath)]);
  for (const entry of options.entries) {
    await collectFiles(dirname(resolve(options.cwd, entry)), files);
  }
  return [...files].sort();
}

/**
 * Options for {@link DevWatcher}.
 *
 * @group Dev
 */
export interface DevWatcherOptions {
  /** Returns the current set of watched files. */
  readonly watch: () => Promise<readonly string[]>;
  /** Poll interval in milliseconds. Defaults to `400`. */
  readonly intervalMs?: number;
  /** Called with the paths that changed since the last poll. */
  readonly onChange: (changed: readonly string[]) => void | Promise<void>;
}

/**
 * A small file watcher that fingerprints `mtimeMs` + `size` on a poll
 * interval. Works everywhere (recursive `fs.watch` is not portable) and needs
 * no native dependency. The first poll only seeds the baseline.
 *
 * @group Dev
 * @example Watch source files for changes
 */
export class DevWatcher {
  private readonly options: DevWatcherOptions;
  private readonly intervalMs: number;
  private last: ReadonlyMap<string, string> | undefined;
  private timer: ReturnType<typeof setInterval> | undefined;

  constructor(options: DevWatcherOptions) {
    this.options = options;
    this.intervalMs = options.intervalMs ?? 400;
  }

  async poll(): Promise<void> {
    const current = new Map<string, string>();
    for (const file of await this.options.watch()) {
      const stats = await stat(file).catch(() => undefined);
      if (stats?.isFile()) {
        current.set(file, `${stats.mtimeMs}:${stats.size}`);
      }
    }

    if (this.last === undefined) {
      this.last = current;
      return;
    }

    const last = this.last;
    const changed = [...current.keys()].filter(
      (file) => last.get(file) !== current.get(file),
    );
    for (const file of last.keys()) {
      if (!current.has(file)) changed.push(file);
    }
    this.last = current;

    if (changed.length > 0) {
      await this.options.onChange(changed);
    }
  }

  start(): void {
    void this.poll();
    this.timer = setInterval(() => {
      void this.poll();
    }, this.intervalMs);
    this.timer.unref();
  }

  stop(): void {
    if (this.timer !== undefined) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }
}

/**
 * Runs the local development loop:
 *
 * 1. Loads `smite.config.ts` and compiles the app entries in collect mode.
 * 2. Runs every generator plugin (typed client, OpenAPI, …).
 * 3. Bundles a runtime dev server with esbuild and spawns it as a child
 *    `node` process.
 * 4. Watches the sources; on change it reloads the config (when the config
 *    itself changed), re-runs the generators, rebundles, and restarts the
 *    server.
 *
 * Resolves when `signal` aborts or the process receives SIGINT/SIGTERM.
 *
 * @group Dev
 */
export async function dev(options: DevOptions = {}): Promise<void> {
  const cwd = process.cwd();
  const configPath = options.config ?? "smite.config.ts";
  const port = options.port ?? Number(process.env.PORT ?? 3000);
  const host = options.host ?? process.env.HOST ?? "127.0.0.1";
  const alias = options.alias;

  let config = await loadConfig(configPath, alias);
  const outfile = join(cwd, DEV_OUTFILE);
  const docs = canResolve("@smitejs/openapi", cwd);

  let child: ChildProcess | undefined;
  let building = false;
  let rebuildRequested = false;

  const buildOnce = async (): Promise<void> => {
    if (building) {
      rebuildRequested = true;
      return;
    }
    building = true;
    try {
      clear();
      const compiledEntries = await compileAppEntries({
        entries: entriesOf(config),
        ...(alias === undefined ? {} : { alias }),
      });
      const apps = appsOf(compiledEntries);
      await runAll(config.plugins, {
        apps,
        entries: entriesOf(config),
        buildEntries: buildEntriesOf(config),
        compiledEntries,
        ...(config.build === undefined ? {} : { build: config.build }),
      });

      const entry = entriesOf(config)[0];
      const title = apps[0]?.__key ?? "Smite app";
      if (entry !== undefined) {
        await bundleDevServer({
          cwd,
          entry,
          ...(alias === undefined ? {} : { alias }),
          docs,
          title,
          outfile,
        });
        if (child !== undefined) child.kill("SIGTERM");
        if (child !== undefined && process.stdout.isTTY === true) {
          process.stdout.write("\u001b[2J\u001b[3J\u001b[H");
        }
        child = spawnServer(outfile, { cwd, port, host });
      }
      report("info", "Generated application", {
        plugins: config.plugins.map((plugin) => plugin.name),
      });
    } catch (error) {
      report("error", error instanceof Error ? error.message : String(error));
    } finally {
      building = false;
      if (rebuildRequested) {
        rebuildRequested = false;
        await buildOnce();
      }
    }
  };

  await buildOnce();

  const wait = (): Promise<void> =>
    new Promise<void>((resolvePromise) => {
      const stop = (): void => {
        child?.kill("SIGTERM");
        resolvePromise();
      };
      if (options.signal !== undefined) {
        options.signal.addEventListener("abort", stop, { once: true });
      } else {
        process.once("SIGINT", stop);
        process.once("SIGTERM", stop);
      }
    });

  if (options.watch !== false) {
    const watcher = new DevWatcher({
      watch: () =>
        collectWatchedFiles({
          cwd,
          configPath,
          entries: entriesOf(config),
        }),
      onChange: async (changed) => {
        if (
          changed.some((file) => resolve(file) === resolve(cwd, configPath))
        ) {
          try {
            config = await loadConfig(configPath, alias);
          } catch (error) {
            report(
              "error",
              error instanceof Error ? error.message : String(error),
            );
            return;
          }
        }
        await buildOnce();
      },
    });
    watcher.start();
    await wait();
    watcher.stop();
    return;
  }

  await wait();
}
