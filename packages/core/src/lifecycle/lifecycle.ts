import { freeze } from "../internal/freeze.js";
import type {
  DescriptorBuilder,
  LifecycleCompositionDescriptor,
  LifecycleEntry,
  LifecycleEntryKind,
  LifecycleEntryOptions,
  LifecycleSource,
} from "../types.js";
import { createLifecycleEntryBuilder } from "./entry.js";
import {
  emptyLifecycleDescriptor,
  mergeLifecycleDescriptors,
} from "./merge.js";

/** Builder returned by lifecycle component factories such as `lifecycle.guard`. */
export type LifecycleEntryBuilder<Kind extends LifecycleEntryKind> =
  DescriptorBuilder<LifecycleEntry<Kind>>;

/** Immutable builder for composing reusable execution policies. */
export interface LifecycleBuilder
  extends DescriptorBuilder<LifecycleCompositionDescriptor> {
  readonly descriptor: LifecycleCompositionDescriptor;
  readonly use: (...sources: readonly LifecycleSource[]) => LifecycleBuilder;
  readonly guards: (
    ...guards: readonly LifecycleEntryBuilder<"guard">[]
  ) => LifecycleBuilder;
  readonly filters: (
    ...filters: readonly LifecycleEntryBuilder<"filter">[]
  ) => LifecycleBuilder;
  readonly interceptors: (
    ...interceptors: readonly LifecycleEntryBuilder<"interceptor">[]
  ) => LifecycleBuilder;
  readonly pipes: (
    ...pipes: readonly LifecycleEntryBuilder<"pipe">[]
  ) => LifecycleBuilder;
  readonly providers: (
    ...providers: readonly LifecycleEntryBuilder<"provider">[]
  ) => LifecycleBuilder;
}

const createBuilder = (
  descriptor: LifecycleCompositionDescriptor,
): LifecycleBuilder =>
  freeze({
    descriptor,
    use: (...sources) =>
      createBuilder(mergeLifecycleDescriptors(descriptor, ...sources)),
    guards: (...guards) =>
      createBuilder(mergeLifecycleDescriptors(descriptor, ...guards)),
    filters: (...filters) =>
      createBuilder(mergeLifecycleDescriptors(descriptor, ...filters)),
    interceptors: (...interceptors) =>
      createBuilder(mergeLifecycleDescriptors(descriptor, ...interceptors)),
    pipes: (...pipes) =>
      createBuilder(mergeLifecycleDescriptors(descriptor, ...pipes)),
    providers: (...providers) =>
      createBuilder(mergeLifecycleDescriptors(descriptor, ...providers)),
  });

/**
 * Namespace for lifecycle component builders and lifecycle compositions.
 *
 * Lifecycle builders describe execution policy only. They do not define
 * transport behavior and they do not execute runtime logic.
 */
export const lifecycle = freeze({
  create: (): LifecycleBuilder => createBuilder(emptyLifecycleDescriptor()),
  guard: (name: string, options?: LifecycleEntryOptions) =>
    createLifecycleEntryBuilder("guard", name, options),
  filter: (name: string, options?: LifecycleEntryOptions) =>
    createLifecycleEntryBuilder("filter", name, options),
  interceptor: (name: string, options?: LifecycleEntryOptions) =>
    createLifecycleEntryBuilder("interceptor", name, options),
  pipe: (name: string, options?: LifecycleEntryOptions) =>
    createLifecycleEntryBuilder("pipe", name, options),
  provider: (name: string, options?: LifecycleEntryOptions) =>
    createLifecycleEntryBuilder("provider", name, options),
});
