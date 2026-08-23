import { access, mkdtemp, rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import * as esbuild from "esbuild";
import type { SmitePlugin } from "./plugins.js";

/**
 * The composition root the CLI reads: the app entries plus the generator
 * plugins contributed by user-installed packages.
 *
 * Serverless apps often declare one entry per handler (a Lambda function, a
 * GCP function, …). Use `entries` for those; `entry` is shorthand for a single
 * entry and equals `entries: [entry]`.
 *
 * @group Config
 */
export interface SmiteConfig {
  /** Shorthand for a single entry; equals `entries: [entry]`. */
  readonly entry?: string;
  /** The app entries to compile in collect mode, one per handler/app. */
  readonly entries?: readonly string[];
  /**
   * Local command entries compiled by `smite run` to find `cli.exe`
   * registrations. Defaults to `entries`. Keep commands in a dedicated entry
   * so they never become serverless functions.
   */
  readonly cliEntries?: readonly string[];
  readonly plugins: readonly SmitePlugin[];
  readonly appName?: string;
  readonly alias?: Readonly<Record<string, string>>;
  readonly build?: SmiteBuildConfig;
}

/**
 * Runtime bundle settings for `smite build`.
 *
 * Shared esbuild options (minify, sourcemap, target, …) go under `esbuild`,
 * straight through to `esbuild.build`, so they reuse esbuild's own typings
 * instead of duplicating fields that drift with esbuild releases.
 *
 * @group Config
 */
export interface SmiteBuildConfig {
  /** Shorthand for a single runtime entry; equals `entries: [entry]`. */
  readonly entry?: string;
  /** Runtime entries to bundle with `ALLOW_GLOBAL_REGISTRY` folded to false. */
  readonly entries?: readonly string[];
  /** Output directory for runtime bundles. Defaults to `dist`. */
  readonly outdir?: string;
  /** Shared options passed to `esbuild.build` for each runtime bundle. */
  readonly esbuild?: esbuild.BuildOptions;
}

/**
 * Resolves the effective entry list: `entries`, else the `entry` shorthand.
 *
 * @group Config
 */
export const entriesOf = (config: SmiteConfig): readonly string[] =>
  config.entries ?? (config.entry !== undefined ? [config.entry] : []);

/**
 * Resolves the local command entries for `smite run`: `cliEntries`, else the
 * app entries.
 *
 * @group Config
 */
export const cliEntriesOf = (config: SmiteConfig): readonly string[] =>
  config.cliEntries ?? entriesOf(config);

/**
 * Resolves the runtime entries for `smite build`: `build.entries`, else the
 * `build.entry` shorthand, else the collect-mode app entries.
 *
 * @group Config
 */
export const buildEntriesOf = (config: SmiteConfig): readonly string[] =>
  config.build?.entries ??
  (config.build?.entry !== undefined
    ? [config.build.entry]
    : entriesOf(config));

/**
 * Type-only helper for `smite.config.ts`; returns its argument unchanged.
 *
 * @group Config
 * @example Define a Smite config
 */
export const defineSmiteConfig = <Config extends SmiteConfig>(
  config: Config,
): Config => config;

const hasNodeModules = async (directory: string): Promise<boolean> => {
  try {
    await access(join(directory, "node_modules"));
    return true;
  } catch {
    return false;
  }
};

const findModulesRoot = async (cwd: string): Promise<string> => {
  let directory = cwd;
  for (;;) {
    if (await hasNodeModules(directory)) {
      return directory;
    }
    const parent = dirname(directory);
    if (parent === directory) {
      return cwd;
    }
    directory = parent;
  }
};

/**
 * Bundles and executes `smite.config.ts`, returning its default export.
 * Written under the nearest `node_modules` so external `esbuild`/`commander`
 * requires resolve; removed in a `finally`.
 *
 * @group Config
 * @example Load a Smite config
 */
export async function loadConfig(
  configPath = "smite.config.ts",
  alias?: Readonly<Record<string, string>>,
): Promise<SmiteConfig> {
  const cwd = process.cwd();
  const configFile = resolve(cwd, configPath);
  const modulesRoot = await findModulesRoot(cwd);

  const dir = await mkdtemp(
    join(modulesRoot, "node_modules", ".smite-config-"),
  );
  const bundlePath = join(dir, "config.cjs");
  try {
    await esbuild.build({
      entryPoints: [configFile],
      outfile: bundlePath,
      bundle: true,
      platform: "node",
      format: "cjs",
      mainFields: ["module", "main"],
      target: "es2022",
      absWorkingDir: cwd,
      external: ["esbuild", "commander"],
      ...(alias === undefined ? {} : { alias }),
    });

    const mod = await import(pathToFileURL(bundlePath).href);
    const root = mod as { default?: SmiteConfig | { default?: SmiteConfig } };
    const unwrapped = root.default;
    const config =
      unwrapped !== undefined &&
      typeof unwrapped === "object" &&
      "default" in unwrapped &&
      (unwrapped as { default?: SmiteConfig }).default !== undefined
        ? (unwrapped as { default?: SmiteConfig }).default
        : (unwrapped as SmiteConfig | undefined);
    if (config === undefined) {
      throw new Error(
        `Config '${configPath}' must export a default config object.`,
      );
    }
    if (entriesOf(config).length === 0) {
      throw new Error(
        `Config '${configPath}' must declare an 'entry' or 'entries'.`,
      );
    }
    return config;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
