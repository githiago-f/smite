import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { compileApp } from "@smite/cli";
import type { SmitePlugin } from "@smite/cli";
import {
  collectEndpoints,
  collectEndpointsFromApps,
  emitClient,
} from "./emit.js";

/**
 * Options for `generate()`.
 *
 * @group Codegen
 */
export interface GenerateOptions {
  readonly entry: string;
  readonly outfile: string;
  readonly appName?: string;
  readonly alias?: Readonly<Record<string, string>>;
}

/**
 * Options for the {@link client} CLI plugin.
 *
 * @group Codegen
 */
export interface ClientPluginOptions {
  readonly outfile: string;
}

/**
 * Compiles the app entry in collect mode, executes it, traverses the registry,
 * and emits a builder-style typed client to `outfile`. Returns the generated
 * source. Shares `compileApp` with the CLI, so the standalone API and the
 * `client()` plugin behave identically.
 *
 * @group Codegen
 * @example Generate a typed client
 */
export async function generate(options: GenerateOptions): Promise<string> {
  const cwd = process.cwd();
  const outfile = resolve(cwd, options.outfile);

  const app = await compileApp({
    entry: options.entry,
    ...(options.appName === undefined ? {} : { appName: options.appName }),
    ...(options.alias === undefined ? {} : { alias: options.alias }),
  });

  const code = emitClient(collectEndpoints(app));
  await mkdir(dirname(outfile), { recursive: true });
  await writeFile(outfile, code, "utf8");
  return code;
}

/**
 * CLI plugin factory for `@smite/cli`: a `client` plugin whose `run` emits the
 * typed client from the compiled app node.
 *
 * @group Codegen
 * @example Register the client plugin
 */
export function client(options: ClientPluginOptions): SmitePlugin {
  return {
    name: "client",
    async run({ apps }) {
      const outfile = resolve(process.cwd(), options.outfile);
      const code = emitClient(collectEndpointsFromApps(apps));
      await mkdir(dirname(outfile), { recursive: true });
      await writeFile(outfile, code, "utf8");
    },
  };
}
