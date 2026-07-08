import { freeze } from "../internal/freeze.js";
import type {
  DescriptorBuilder,
  LifecycleCompositionDescriptor,
  LifecycleEntry,
  LifecycleEntryImplementation,
  LifecycleEntryKind,
  LifecycleEntryOptions,
  LifecycleSource,
} from "../types.js";
import { createLifecycleEntryBuilder } from "./entry.js";
import {
  emptyLifecycleDescriptor,
  mergeLifecycleDescriptors,
} from "./merge.js";

/**
 * Builder returned by lifecycle component factories such as `lifecycle.guard`.
 *
 * @group Lifecycle
 * @intent Represents one reusable lifecycle concern that can be merged into policies.
 * @example Lifecycle adapters
 */
export type LifecycleEntryBuilder<Kind extends LifecycleEntryKind> =
  DescriptorBuilder<LifecycleEntry<Kind>>;

export type LifecycleEntryDefinition =
  | readonly [options?: LifecycleEntryOptions]
  | readonly [
      implementation: LifecycleEntryImplementation,
      options?: LifecycleEntryOptions,
    ];

/**
 * Immutable builder for composing reusable execution policies.
 *
 * @group Lifecycle
 * @intent Collects guards, filters, providers, interceptors and pipes without binding them to a transport.
 * @example Reusable lifecycle composition
 */
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
 * Lifecycle builders describe execution policy and may reference runtime
 * behavior. They do not execute runtime logic.
 *
 * @group Lifecycle
 * @intent Public namespace for creating lifecycle component builders and reusable policy compositions.
 * @example Lifecycle adapters
 * @example Reusable lifecycle composition
 */
export const lifecycle = freeze({
  create: (): LifecycleBuilder => createBuilder(emptyLifecycleDescriptor()),
  guard: (name: string, ...definition: LifecycleEntryDefinition) =>
    createLifecycleEntryBuilder("guard", name, ...definition),
  filter: (name: string, ...definition: LifecycleEntryDefinition) =>
    createLifecycleEntryBuilder("filter", name, ...definition),
  interceptor: (name: string, ...definition: LifecycleEntryDefinition) =>
    createLifecycleEntryBuilder("interceptor", name, ...definition),
  pipe: (name: string, ...definition: LifecycleEntryDefinition) =>
    createLifecycleEntryBuilder("pipe", name, ...definition),
  provider: (name: string, ...definition: LifecycleEntryDefinition) =>
    createLifecycleEntryBuilder("provider", name, ...definition),
});
