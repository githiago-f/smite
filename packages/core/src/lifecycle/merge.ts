import { freeze, freezeArray } from "../internal/freeze.js";
import type {
  DescriptorBuilder,
  LifecycleCompositionDescriptor,
  LifecycleEntry,
  LifecycleSource,
} from "../types.js";

export const emptyLifecycleDescriptor = (): LifecycleCompositionDescriptor =>
  freeze({
    kind: "lifecycle.composition",
    entries: freezeArray([]),
  });

/**
 * Merge lifecycle entries and compositions into one immutable descriptor.
 *
 * Compilers use this to flatten policies from controller, route and reusable
 * lifecycle declarations before generating runtime pipelines.
 */
export const mergeLifecycleDescriptors = (
  ...sources: readonly LifecycleSource[]
): LifecycleCompositionDescriptor => {
  const entries: LifecycleEntry[] = [];

  for (const rawSource of sources) {
    const source = unwrapLifecycleSource(rawSource);

    if (source.kind === "lifecycle.entry") {
      entries.push(source);
      continue;
    }

    entries.push(...source.entries);
  }

  return freeze({
    kind: "lifecycle.composition",
    entries: freezeArray(entries),
  });
};

const unwrapLifecycleSource = (
  source: LifecycleSource,
): LifecycleCompositionDescriptor | LifecycleEntry => {
  if ("descriptor" in source) {
    return source.descriptor;
  }

  return source;
};
