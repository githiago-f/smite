import { mkdir } from "node:fs/promises";
import { dirname, extname, join, relative, resolve } from "node:path";
import { clear } from "@smitejs/core";
import * as esbuild from "esbuild";
import { appsOf, compileAppEntries } from "./compile.js";
import { buildEntriesOf, entriesOf, loadConfig } from "./config.js";
import type { SmiteBuildConfig } from "./config.js";
import { runAll } from "./plugins.js";

/**
 * Options for {@link bundleBuildEntries}.
 *
 * @group Build
 */
export interface BundleBuildEntriesOptions extends SmiteBuildConfig {
  readonly cwd: string;
  readonly entries: readonly string[];
  readonly alias?: Readonly<Record<string, string>>;
}

/**
 * Options for {@link build}.
 *
 * @group Build
 */
export interface BuildOptions {
  /** Path to the config file. Defaults to `smite.config.ts`. */
  readonly config?: string;
  /** Monorepo aliases passed to collect-mode and runtime bundles. */
  readonly alias?: Readonly<Record<string, string>>;
}

const outputPath = (cwd: string, outdir: string, entry: string): string => {
  const absolute = resolve(cwd, entry);
  const relativePath = relative(cwd, absolute);
  const withoutExtension = relativePath.slice(
    0,
    relativePath.length - extname(relativePath).length,
  );
  const normalized = withoutExtension.startsWith("src/")
    ? withoutExtension.slice(4)
    : withoutExtension;
  return join(cwd, outdir, `${normalized}.mjs`);
};

/**
 * Bundles runtime entries for production/deployment. The registry flag is
 * always folded to `false`, so runtime bundles cannot collect descriptors.
 *
 * @group Build
 * @example Bundle runtime entries
 */
export async function bundleBuildEntries(
  options: BundleBuildEntriesOptions,
): Promise<readonly string[]> {
  const outdir = options.outdir ?? "dist";
  const outfiles: string[] = [];

  for (const entry of options.entries) {
    const outfile = outputPath(options.cwd, outdir, entry);
    await mkdir(dirname(outfile), { recursive: true });
    await esbuild.build({
      entryPoints: [resolve(options.cwd, entry)],
      outfile,
      platform: "node",
      format: "esm",
      ...options.esbuild,
      ...(options.alias === undefined ? {} : { alias: options.alias }),
      bundle: options.esbuild?.bundle ?? true,
      minify: options.esbuild?.minify ?? true,
      define: {
        ...(options.esbuild?.define ?? {}),
        ALLOW_GLOBAL_REGISTRY: "false",
      },
      absWorkingDir: options.cwd,
    });
    outfiles.push(outfile);
  }

  return outfiles;
}

/**
 * Runs a production build: load config, compile app entries in collect mode,
 * run every generator plugin, then bundle runtime entries with descriptor
 * collection disabled.
 *
 * @group Build
 */
export async function build(
  options: BuildOptions = {},
): Promise<readonly string[]> {
  const cwd = process.cwd();
  const configPath = options.config ?? "smite.config.ts";
  const config = await loadConfig(configPath, options.alias);
  const alias = options.alias ?? config.alias;

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

  return bundleBuildEntries({
    cwd,
    entries: buildEntriesOf(config),
    ...(alias === undefined ? {} : { alias }),
    ...(config.build === undefined ? {} : config.build),
  });
}
