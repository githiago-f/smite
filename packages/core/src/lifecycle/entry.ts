import { freeze } from "../internal/freeze.js";
import type {
  DescriptorBuilder,
  LifecycleEntry,
  LifecycleEntryKind,
  LifecycleEntryOptions,
} from "../types.js";

export type LifecycleEntryBuilder<Kind extends LifecycleEntryKind> =
  DescriptorBuilder<LifecycleEntry<Kind>>;

export const createLifecycleEntry = <Kind extends LifecycleEntryKind>(
  entryKind: Kind,
  name: string,
  options?: LifecycleEntryOptions,
): LifecycleEntry<Kind> => {
  const descriptor: LifecycleEntry<Kind> = options
    ? {
        kind: "lifecycle.entry",
        entryKind,
        name,
        options: freeze({ ...options }),
      }
    : {
        kind: "lifecycle.entry",
        entryKind,
        name,
      };

  return freeze(descriptor);
};

export const createLifecycleEntryBuilder = <Kind extends LifecycleEntryKind>(
  entryKind: Kind,
  name: string,
  options?: LifecycleEntryOptions,
): LifecycleEntryBuilder<Kind> =>
  freeze({
    descriptor: createLifecycleEntry(entryKind, name, options),
  });
