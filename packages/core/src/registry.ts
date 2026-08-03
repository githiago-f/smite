import type { Descriptor, RelationshipDescriptor } from "./descriptor.js";

type RegistryMap = Map<string, Descriptor<string, unknown>>;

const getRegistry = (): RegistryMap => {
  const g = globalThis as typeof globalThis & { globalRegistry?: RegistryMap };
  return (g.globalRegistry ??= new Map());
};

/**
 * Inserts a descriptor into the global registry. Collect mode only.
 *
 * @group Registry
 * @example Query and clear the registry
 */
export function register(descriptor: Descriptor<string, unknown>): void {
  const registry = getRegistry();
  if (registry.has(descriptor.__key)) {
    throw new Error(
      `Duplicate descriptor key '${descriptor.__key}' (kind '${descriptor.__kind}').`,
    );
  }
  registry.set(descriptor.__key, descriptor);
}

/**
 * Looks up a single descriptor by key.
 *
 * @group Registry
 * @example Define and look up a descriptor
 */
export function lookup(key: string): Descriptor<string, unknown> | undefined {
  return getRegistry().get(key);
}

/**
 * Lists every descriptor of a given kind.
 *
 * @group Registry
 * @example Query and clear the registry
 */
export function lookupAll(
  kind: string,
): readonly Descriptor<string, unknown>[] {
  return [...getRegistry().values()].filter((d) => d.__kind === kind);
}

/**
 * Lists every relationship edge in the registry.
 *
 * @group Registry
 * @example Query and clear the registry
 */
export function relationships(): readonly RelationshipDescriptor[] {
  return [...getRegistry().values()].filter(
    (d): d is RelationshipDescriptor => d.__kind === "relationship",
  );
}

/**
 * Empties the global registry.
 *
 * @group Registry
 * @example Query and clear the registry
 */
export function clear(): void {
  getRegistry().clear();
}
