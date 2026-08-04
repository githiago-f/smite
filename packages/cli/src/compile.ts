import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { clear, lookupAll } from "@smitejs/core";
import type { AppDescriptor, Descriptor } from "@smitejs/core";
import * as esbuild from "esbuild";

/**
 * Options for {@link compileApps}.
 *
 * @group Compile
 */
export interface CompileAppsOptions {
  readonly entries: readonly string[];
  readonly alias?: Readonly<Record<string, string>>;
}

/**
 * Options for {@link compileApp}.
 *
 * @group Compile
 */
export interface CompileAppOptions {
  readonly entry: string;
  readonly appName?: string;
  readonly alias?: Readonly<Record<string, string>>;
}

/** The descriptor snapshot collected from one runtime entry. */
export interface CompiledEntry {
  readonly entry: string;
  readonly apps: readonly AppDescriptor[];
  readonly descriptors: readonly Descriptor<string, unknown>[];
}

/** Returns the deduplicated app union from compiled entry snapshots. */
export function appsOf(
  entries: readonly CompiledEntry[],
): readonly AppDescriptor[] {
  const apps = new Map<string, AppDescriptor>();
  for (const compiled of entries) {
    for (const app of compiled.apps) apps.set(app.__key, app);
  }
  return [...apps.values()];
}

const bundleAndExecute = async (
  entry: string,
  cwd: string,
  alias: Readonly<Record<string, string>> | undefined,
): Promise<void> => {
  const dir = await mkdtemp(join(tmpdir(), "smite-cli-"));
  const bundlePath = join(dir, "app.cjs");
  try {
    await esbuild.build({
      entryPoints: [resolve(cwd, entry)],
      outfile: bundlePath,
      bundle: true,
      platform: "node",
      format: "cjs",
      target: "es2022",
      define: { ALLOW_GLOBAL_REGISTRY: "true" },
      absWorkingDir: cwd,
      ...(alias === undefined ? {} : { alias }),
    });
    clear();
    await import(pathToFileURL(bundlePath).href);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
};

/**
 * Bundles each app entry in collect mode, executes it, and returns the union of
 * app nodes registered across all entries, deduplicated by `__key`. Each entry
 * compiles in its own registry session (a serverless handler does not see the
 * descriptors of its siblings), so the same app declared in several handler
 * entries collapses to a single node.
 *
 * Uses this package's own `@smitejs/core` copy to read the registry, which works
 * across module instances because the registry lives on `globalThis` and the
 * child index uses `Symbol.for`.
 *
 * @group Compile
 * @example Compile multiple app entries
 */
export async function compileApps(
  options: CompileAppsOptions,
): Promise<readonly AppDescriptor[]> {
  return appsOf(await compileAppEntries(options));
}

/**
 * Bundles each entry in collect mode and retains its descriptor graph for
 * artifact generators that need entry-scoped metadata.
 */
export async function compileAppEntries(
  options: CompileAppsOptions,
): Promise<readonly CompiledEntry[]> {
  const compiled: CompiledEntry[] = [];
  const cwd = process.cwd();

  for (const entry of options.entries) {
    await bundleAndExecute(entry, cwd, options.alias);
    const descriptors = lookupAll();
    const apps = descriptors.filter(
      (descriptor): descriptor is AppDescriptor => descriptor.__kind === "app",
    );
    compiled.push({ entry, apps, descriptors });
  }

  return compiled;
}

/**
 * Bundles a single app entry in collect mode, executes it, and locates the app
 * node in `globalThis.globalRegistry`. Thin wrapper over {@link compileApps}
 * for the single-entry case.
 *
 * @group Compile
 * @example Compile an app entry
 */
export async function compileApp(
  options: CompileAppOptions,
): Promise<AppDescriptor> {
  const apps = await compileApps({
    entries: [options.entry],
    ...(options.alias === undefined ? {} : { alias: options.alias }),
  });
  if (apps.length === 0) {
    throw new Error(
      "No app found in the registry. The entry must call http.app() at module scope.",
    );
  }
  const app =
    apps.length === 1
      ? apps[0]
      : apps.find((candidate) => candidate.__key === options.appName);
  if (app === undefined) {
    throw new Error(
      apps.length > 1
        ? `Multiple apps found (${apps
            .map((candidate) => candidate.__key)
            .join(", ")}). Pass an appName.`
        : `App '${options.appName}' was not found in the registry.`,
    );
  }
  return app;
}
