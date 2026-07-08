import { freeze } from "../internal/freeze.js";
import type {
  DescriptorBuilder,
  LifecycleEntry,
  LifecycleEntryImplementation,
  LifecycleEntryKind,
  LifecycleEntryOptions,
} from "../types.js";

export type LifecycleEntryBuilder<Kind extends LifecycleEntryKind> =
  DescriptorBuilder<LifecycleEntry<Kind>>;

export const createLifecycleEntry = <Kind extends LifecycleEntryKind>(
  entryKind: Kind,
  name: string,
  implementationOrOptions?:
    | LifecycleEntryImplementation
    | LifecycleEntryOptions,
  options?: LifecycleEntryOptions,
): LifecycleEntry<Kind> => {
  const definition = normalizeLifecycleEntryDefinition(
    implementationOrOptions,
    options,
  );
  const descriptor: LifecycleEntry<Kind> = definition.options
    ? {
        kind: "lifecycle.entry",
        entryKind,
        name,
        ...definition.implementation,
        options: freeze({ ...definition.options }),
      }
    : {
        kind: "lifecycle.entry",
        entryKind,
        name,
        ...definition.implementation,
      };

  return freeze(descriptor);
};

export const createLifecycleEntryBuilder = <Kind extends LifecycleEntryKind>(
  entryKind: Kind,
  name: string,
  implementationOrOptions?:
    | LifecycleEntryImplementation
    | LifecycleEntryOptions,
  options?: LifecycleEntryOptions,
): LifecycleEntryBuilder<Kind> =>
  freeze({
    descriptor: createLifecycleEntry(
      entryKind,
      name,
      implementationOrOptions,
      options,
    ),
  });

const normalizeLifecycleEntryDefinition = (
  implementationOrOptions?:
    | LifecycleEntryImplementation
    | LifecycleEntryOptions,
  options?: LifecycleEntryOptions,
): {
  readonly implementation?: {
    readonly implementation: LifecycleEntryImplementation;
  };
  readonly options?: LifecycleEntryOptions;
} => {
  if (typeof implementationOrOptions === "function") {
    const definition = {
      implementation: { implementation: implementationOrOptions },
    };

    return options ? { ...definition, options } : definition;
  }

  return implementationOrOptions ? { options: implementationOrOptions } : {};
};
