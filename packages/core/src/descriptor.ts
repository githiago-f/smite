import { deepFreeze, freeze } from "./internal/freeze.js";
import { register } from "./registry.js";

declare const ALLOW_GLOBAL_REGISTRY: boolean;

/**
 * A node in the IR: a typed `__kind`, a unique `__key`, and a frozen `data`
 * snapshot.
 *
 * @group Descriptors
 */
export interface Descriptor<Kind extends string, Data> {
  readonly __kind: Kind;
  readonly __key: string;
  readonly data: Data;
}

/**
 * An edge in the IR, created by `relate`, carrying `from`, `to`, `relation`,
 * and optional data.
 *
 * @group Descriptors
 */
export interface RelationshipDescriptor<
  Rel extends string = string,
  Data = undefined,
> extends Descriptor<
    "relationship",
    Readonly<{
      from: string;
      to: string;
      relation: Rel;
      data?: Data;
    }>
  > {}

/** Symbol key for the runtime child index attached to parent descriptors. */
export const children: unique symbol = Symbol.for("@smite/core/children");

type ChildIndex = ReadonlyMap<string, readonly Descriptor<string, unknown>[]>;

type Parent = Descriptor<string, unknown> & { [children]?: ChildIndex };

/**
 * Creates a descriptor node and (in collect mode) registers it.
 *
 * @group Descriptors
 * @example Define and look up a descriptor
 */
export function defineDescriptor<Kind extends string, Data>(
  kind: Kind,
  key: string,
  data: Data,
): Descriptor<Kind, Data> {
  const descriptor = { __kind: kind, __key: key, data: freeze(data) };
  if (typeof ALLOW_GLOBAL_REGISTRY === "boolean" && ALLOW_GLOBAL_REGISTRY) {
    register(descriptor);
  }
  return descriptor;
}

/**
 * Creates an edge between two descriptors and attaches it to the parent's
 * runtime child index.
 *
 * @group Descriptors
 * @example Relate nodes and walk children
 */
export function relate<
  Rel extends string,
  From extends Descriptor<string, unknown>,
  To extends Descriptor<string, unknown>,
  Data = undefined,
>(
  from: From,
  relation: Rel,
  to: To,
  data?: Data,
): RelationshipDescriptor<Rel, Data> {
  appendChild(from, relation, to);

  const relationship: RelationshipDescriptor<Rel, Data> = freeze({
    __kind: "relationship",
    __key: `${from.__key}->${relation}->${to.__key}`,
    data: freeze({
      from: from.__key,
      to: to.__key,
      relation,
      ...(data !== undefined ? { data } : {}),
    }),
  });

  if (typeof ALLOW_GLOBAL_REGISTRY === "boolean" && ALLOW_GLOBAL_REGISTRY) {
    register(relationship);
  }
  return relationship;
}

const appendChild = (
  from: Descriptor<string, unknown>,
  relation: string,
  to: Descriptor<string, unknown>,
): void => {
  const parent = from as Parent;
  let index = parent[children];
  if (index === undefined) {
    index = new Map();
    Object.defineProperty(parent, children, {
      configurable: false,
      enumerable: false,
      writable: false,
      value: index,
    });
  }
  const current = index.get(relation) ?? [];
  (index as Map<string, readonly Descriptor<string, unknown>[]>).set(relation, [
    ...current,
    to,
  ]);
};

/**
 * Walks the runtime child index of a descriptor, optionally filtered by
 * relation.
 *
 * @group Descriptors
 * @example Relate nodes and walk children
 */
export function childrenOf(
  from: Descriptor<string, unknown>,
  relation?: string,
): readonly Descriptor<string, unknown>[] {
  const index = (from as Parent)[children];
  if (index === undefined) return [];
  if (relation === undefined) {
    return [...index.values()].flat();
  }
  return index.get(relation) ?? [];
}

/**
 * Replaces the node's data with a frozen shallow-merged snapshot.
 *
 * @group Descriptors
 * @example Refine descriptor data
 */
export function refine<Data>(
  descriptor: { data: Data },
  patch: Record<string, unknown>,
): void {
  (descriptor as { data: Data }).data = freeze({
    ...descriptor.data,
    ...patch,
  });
}

/**
 * Deep-freeze the IR reachable from `root`: the node, its data, and every
 * child (via the child index), recursively. Guards against cycles.
 *
 * @group Descriptors
 * @example Finalize the descriptor graph
 */
export function finalizeDescriptor<D extends Descriptor<string, unknown>>(
  root: D,
): D {
  const seen = new Set<Descriptor<string, unknown>>();

  const visit = (node: Descriptor<string, unknown>): void => {
    if (seen.has(node)) return;
    seen.add(node);

    for (const child of childrenOf(node)) {
      visit(child);
    }

    deepFreeze(node);
  };

  visit(root);
  return root;
}
