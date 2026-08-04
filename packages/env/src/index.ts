import { defineDescriptor, lookup } from "@smitejs/core";
import type { z } from "zod";

declare const ALLOW_GLOBAL_REGISTRY: boolean;

/**
 * Source of raw environment values: `(key) => Promise<raw>`.
 *
 * @group Providers
 */
export type EnvProvider = (key: string) => Promise<unknown>;

/**
 * A declared variable: the raw provider key plus its zod validation.
 *
 * @group Registration
 */
export type EnvSpec<Value = unknown> = {
  readonly key: string;
  readonly validation: z.ZodType<Value>;
};

/**
 * A map of declared name to its spec.
 *
 * @group Registration
 */
export type EnvSpecs = Readonly<Record<string, EnvSpec>>;

/**
 * The resolved instance: one lazily-resolved property per declared name.
 *
 * @group Resolution
 */
export type EnvInstance<Specs extends EnvSpecs> = {
  readonly [Name in keyof Specs]: Promise<z.infer<Specs[Name]["validation"]>>;
};

/**
 * Per-instance options passed to {@link EnvBuilder.withProvider}.
 *
 * @group Resolution
 */
export type EnvProviderOptions = {
  /**
   * Whether resolved values are cached for the instance. Defaults to `true`;
   * set `false` to re-read through the provider on every access.
   */
  readonly cache?: boolean;
};

/**
 * Builder returned by {@link register}; attach a provider to get an instance.
 *
 * @group Registration
 */
export interface EnvBuilder<Specs extends EnvSpecs> {
  readonly withProvider: (
    provider: EnvProvider,
    options?: EnvProviderOptions,
  ) => EnvInstance<Specs>;
}

const resolve = async (
  provider: EnvProvider,
  spec: EnvSpec,
): Promise<unknown> => {
  const raw = await provider(spec.key);
  const parsed = spec.validation.safeParse(raw);
  if (parsed.success) return parsed.data;
  const missing = raw === undefined || raw === "";
  throw new Error(
    `${missing ? "Missing" : "Invalid"} env var '${spec.key}': ${
      parsed.error.issues[0]?.message ?? "invalid value"
    }.`,
  );
};

/**
 * Declares a set of env variables and returns a builder that becomes a scoped
 * instance once a provider is attached. Fails on duplicate names. In collect
 * mode each variable is also registered as an `env.var` node.
 *
 * @group Registration
 * @example Declare and resolve an env var
 * @example Coerce and default env values
 * @example Read optional env vars
 */
export function register<Specs extends EnvSpecs>(
  entries: Specs,
): EnvBuilder<Specs> {
  const specs = new Map<string, EnvSpec>();

  for (const [name, spec] of Object.entries(entries)) {
    if (specs.has(name)) {
      throw new Error(`Env var '${name}' is already registered.`);
    }
    if (typeof ALLOW_GLOBAL_REGISTRY === "boolean" && ALLOW_GLOBAL_REGISTRY) {
      const existing = lookup(name);
      if (existing === undefined || existing.__kind !== "env.var") {
        // TODO: the future @smitejs/cli consumes these nodes to scaffold
        // .env.example files and validate required vars at compile time.
        defineDescriptor("env.var", name, { spec });
      }
    }
    specs.set(name, spec);
  }

  return {
    withProvider: (provider, options) => {
      const cache = new Map<string, Promise<unknown>>();
      const useCache = options?.cache !== false;

      const instance = {} as EnvInstance<Specs>;
      for (const [name, spec] of specs) {
        Object.defineProperty(instance, name, {
          configurable: false,
          enumerable: true,
          get: () => {
            if (!useCache) return resolve(provider, spec);
            let pending = cache.get(name);
            if (pending === undefined) {
              pending = resolve(provider, spec);
              cache.set(name, pending);
            }
            return pending;
          },
        });
      }

      return Object.freeze(instance);
    },
  };
}

/**
 * The env factory: declare variables, attach a provider, read values.
 *
 * @group Surface
 * @example Declare and resolve an env var
 */
export const env = {
  register,
};
