import { freeze } from "../internal/freeze.js";
import type {
  DescriptorBuilder,
  HttpExecutionContext,
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

/**
 * Builder returned by lifecycle component factories such as `lifecycle.guard`.
 *
 * @group Lifecycle
 * @intent Represents one reusable lifecycle concern that can be merged into policies.
 * @example Lifecycle adapters
 */
export type LifecycleEntryBuilder<Kind extends LifecycleEntryKind> =
  DescriptorBuilder<LifecycleEntry<Kind>>;

/**
 * Runtime implementation referenced by a guard.
 *
 * Receives the execution context and decides whether execution may continue.
 *
 * @group Lifecycle
 */
export type GuardImplementation<Context = HttpExecutionContext> = (
  context: Context,
) => unknown;

/**
 * Runtime implementation referenced by a filter.
 *
 * Receives the captured error and the execution context, and may return a
 * handled result.
 *
 * @group Lifecycle
 */
export type FilterImplementation<
  ErrorValue = unknown,
  Context = HttpExecutionContext,
> = (error: ErrorValue, context: Context) => unknown;

/**
 * Runtime implementation referenced by a pipe.
 *
 * Receives the request body and the execution context, and returns the
 * transformed body.
 *
 * @group Lifecycle
 */
export type PipeImplementation<
  Body = unknown,
  Context = HttpExecutionContext,
> = (body: Body, context: Context) => unknown;

/**
 * Runtime implementation referenced by a provider.
 *
 * Receives the execution context and returns the value stored in context
 * state.
 *
 * @group Lifecycle
 */
export type ProviderImplementation<Context = HttpExecutionContext> = (
  context: Context,
) => unknown;

/**
 * Runtime implementation referenced by an interceptor.
 *
 * Receives the execution context for side effects.
 *
 * @group Lifecycle
 */
export type InterceptorImplementation<Context = HttpExecutionContext> = (
  context: Context,
) => unknown;

/**
 * Definition accepted by `lifecycle.guard`.
 *
 * Either a runtime implementation or only options.
 *
 * @group Lifecycle
 */
export type GuardDefinition<Context = HttpExecutionContext> = readonly [
  implementationOrOptions?:
    | GuardImplementation<Context>
    | LifecycleEntryOptions,
  options?: LifecycleEntryOptions,
];

/**
 * Definition accepted by `lifecycle.filter`.
 *
 * Either a runtime implementation or only options.
 *
 * @group Lifecycle
 */
export type FilterDefinition<
  ErrorValue = unknown,
  Context = HttpExecutionContext,
> = readonly [
  implementationOrOptions?:
    | FilterImplementation<ErrorValue, Context>
    | LifecycleEntryOptions,
  options?: LifecycleEntryOptions,
];

/**
 * Definition accepted by `lifecycle.pipe`.
 *
 * Either a runtime implementation or only options.
 *
 * @group Lifecycle
 */
export type PipeDefinition<
  Body = unknown,
  Context = HttpExecutionContext,
> = readonly [
  implementationOrOptions?:
    | PipeImplementation<Body, Context>
    | LifecycleEntryOptions,
  options?: LifecycleEntryOptions,
];

/**
 * Definition accepted by `lifecycle.provider`.
 *
 * Either a runtime implementation or only options.
 *
 * @group Lifecycle
 */
export type ProviderDefinition<Context = HttpExecutionContext> = readonly [
  implementationOrOptions?:
    | ProviderImplementation<Context>
    | LifecycleEntryOptions,
  options?: LifecycleEntryOptions,
];

/**
 * Definition accepted by `lifecycle.interceptor`.
 *
 * Either a runtime implementation or only options.
 *
 * @group Lifecycle
 */
export type InterceptorDefinition<Context = HttpExecutionContext> = readonly [
  implementationOrOptions?:
    | InterceptorImplementation<Context>
    | LifecycleEntryOptions,
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
  guard: <Context = HttpExecutionContext>(
    name: string,
    ...definition: GuardDefinition<Context>
  ): LifecycleEntryBuilder<"guard"> =>
    createLifecycleEntryBuilder("guard", name, ...definition),
  filter: <ErrorValue = unknown, Context = HttpExecutionContext>(
    name: string,
    ...definition: FilterDefinition<ErrorValue, Context>
  ): LifecycleEntryBuilder<"filter"> =>
    createLifecycleEntryBuilder("filter", name, ...definition),
  interceptor: <Context = HttpExecutionContext>(
    name: string,
    ...definition: InterceptorDefinition<Context>
  ): LifecycleEntryBuilder<"interceptor"> =>
    createLifecycleEntryBuilder("interceptor", name, ...definition),
  pipe: <Body = unknown, Context = HttpExecutionContext>(
    name: string,
    ...definition: PipeDefinition<Body, Context>
  ): LifecycleEntryBuilder<"pipe"> =>
    createLifecycleEntryBuilder("pipe", name, ...definition),
  provider: <Context = HttpExecutionContext>(
    name: string,
    ...definition: ProviderDefinition<Context>
  ): LifecycleEntryBuilder<"provider"> =>
    createLifecycleEntryBuilder("provider", name, ...definition),
});
