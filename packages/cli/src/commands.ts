import { defineDescriptor } from "@smitejs/core";
import type { AppDescriptor, Descriptor } from "@smitejs/core";
import type { CompiledEntry } from "./compile.js";

declare const ALLOW_GLOBAL_REGISTRY: boolean;

/**
 * Context passed to a local command handler registered with {@link exe}.
 *
 * @group Commands
 */
export interface CliRunContext {
  /** The union of app nodes collected from the compiled command entries. */
  readonly apps: readonly AppDescriptor[];
  /** The command entry paths compiled for this run. */
  readonly entries?: readonly string[];
  /** Per-entry descriptor snapshots from the collect-mode compile. */
  readonly compiledEntries?: readonly CompiledEntry[];
}

/**
 * A local command registered with {@link exe} and collected from compiled
 * entries by {@link collectCommands}.
 *
 * @group Commands
 */
export interface CliCommandDescriptor
  extends Descriptor<
    "cli.command",
    {
      readonly name: string;
      readonly fn: (ctx: CliRunContext) => void | Promise<void>;
    }
  > {}

const COMMAND_NAME = /^[A-Za-z0-9][A-Za-z0-9:_-]*$/;

/**
 * Registers a local CLI command callable with `smite run <name>`. The handler
 * closes over the module scope it is declared in, so it can reach the app,
 * `@smitejs/aws` providers, and generated artifacts directly. Registration is
 * collect-mode only; production runtime bundles fold it out.
 *
 * @group Commands
 * @example Register a local command
 */
export function exe(
  name: string,
  handler: (ctx: CliRunContext) => void | Promise<void>,
): void {
  if (!COMMAND_NAME.test(name)) {
    throw new Error(
      `Command name '${name}' must start with a letter or digit and use only [A-Za-z0-9:_-].`,
    );
  }
  if (typeof ALLOW_GLOBAL_REGISTRY === "boolean" && ALLOW_GLOBAL_REGISTRY) {
    defineDescriptor("cli.command", `cli.command:${name}`, {
      name,
      fn: handler,
    });
  }
}

/**
 * The local-command DSL surface: `cli.exe('name', handler)`.
 *
 * @group Commands
 */
export const cli = {
  exe,
};

/**
 * Collects the `cli.command` descriptors registered across compiled entries,
 * deduplicated by name. Duplicate names across entries throw.
 *
 * @group Commands
 */
export function collectCommands(
  compiledEntries: readonly CompiledEntry[],
): readonly CliCommandDescriptor[] {
  const commands = new Map<
    string,
    { readonly command: CliCommandDescriptor; readonly entry: string }
  >();
  for (const compiled of compiledEntries) {
    for (const descriptor of compiled.descriptors) {
      if (descriptor.__kind !== "cli.command") continue;
      const command = descriptor as CliCommandDescriptor;
      const existing = commands.get(command.data.name);
      if (existing !== undefined) {
        throw new Error(
          `Duplicate command name '${command.data.name}' in '${compiled.entry}' (already registered in '${existing.entry}').`,
        );
      }
      commands.set(command.data.name, {
        command,
        entry: compiled.entry,
      });
    }
  }
  return [...commands.values()].map(({ command }) => command);
}

/**
 * Runs the command whose `name` matches, erroring on unknown or duplicate
 * names. Used by `smite run <name>`.
 *
 * @group Commands
 */
export async function runCommand(
  commands: readonly CliCommandDescriptor[],
  name: string,
  ctx: CliRunContext,
): Promise<void> {
  const matches = commands.filter((command) => command.data.name === name);
  if (matches.length === 0) {
    throw new Error(
      `Unknown command '${name}'. Available: ${commands
        .map((command) => command.data.name)
        .join(", ")}.`,
    );
  }
  if (matches.length > 1) {
    throw new Error(`Duplicate command name '${name}'.`);
  }
  const command = matches[0];
  if (command === undefined) {
    throw new Error(`Unknown command '${name}'.`);
  }
  await command.data.fn(ctx);
}
