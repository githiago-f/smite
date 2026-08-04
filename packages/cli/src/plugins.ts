import type { AppDescriptor } from "@smitejs/core";
import type { CompiledEntry } from "./compile.js";
import type { SmiteBuildConfig } from "./config.js";

/**
 * The context every generator receives: the union of app nodes registered by
 * all compiled entries. Generators traverse the IR themselves via `childrenOf`
 * for the kinds they know.
 *
 * @group Plugins
 */
export interface PluginContext {
  readonly apps: readonly AppDescriptor[];
  readonly entries?: readonly string[];
  readonly buildEntries?: readonly string[];
  readonly build?: SmiteBuildConfig;
  readonly compiledEntries?: readonly CompiledEntry[];
}

/**
 * A generator contributed by a user-installed package. The CLI loads plugins
 * from `smite.config.ts` and runs the one named on the command line.
 *
 * @group Plugins
 */
export interface SmitePlugin {
  readonly name: string;
  readonly run: (ctx: PluginContext) => void | Promise<void>;
  readonly deploy?: () => void | Promise<void>;
}

/**
 * Runs the plugin whose `name` matches, erroring on unknown or duplicate
 * names.
 *
 * @group Plugins
 * @example Dispatch a plugin by name
 */
export async function dispatch(
  plugins: readonly SmitePlugin[],
  name: string,
  ctx: PluginContext,
): Promise<void> {
  const matches = plugins.filter((plugin) => plugin.name === name);
  if (matches.length === 0) {
    throw new Error(
      `Unknown plugin '${name}'. Available: ${plugins
        .map((plugin) => plugin.name)
        .join(", ")}.`,
    );
  }
  if (matches.length > 1) {
    throw new Error(`Duplicate plugin name '${name}'.`);
  }
  const plugin = matches[0];
  if (plugin === undefined) {
    throw new Error(`Unknown plugin '${name}'.`);
  }
  await plugin.run(ctx);
}

/**
 * Runs every plugin in declaration order. Used by `smite dev` to regenerate
 * all artifacts before serving.
 *
 * @group Plugins
 * @example Run all configured plugins
 */
export async function runAll(
  plugins: readonly SmitePlugin[],
  ctx: PluginContext,
): Promise<void> {
  for (const plugin of plugins) {
    await plugin.run(ctx);
  }
}

/**
 * Deploys through the named provider plugin after its artifact has been
 * generated.
 *
 * @group Plugins
 */
export async function deploy(
  plugins: readonly SmitePlugin[],
  name: string,
): Promise<void> {
  const matches = plugins.filter((plugin) => plugin.name === name);
  if (matches.length === 0) {
    throw new Error(
      `Unknown deployment plugin '${name}'. Available: ${plugins
        .filter((plugin) => plugin.deploy !== undefined)
        .map((plugin) => plugin.name)
        .join(", ")}.`,
    );
  }
  if (matches.length > 1) {
    throw new Error(`Duplicate plugin name '${name}'.`);
  }
  const plugin = matches[0];
  if (plugin?.deploy === undefined) {
    throw new Error(`Plugin '${name}' does not support deployment.`);
  }
  await plugin.deploy();
}
