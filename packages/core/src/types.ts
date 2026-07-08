/** A callable application handler referenced by transport descriptors. */
export type HandlerReference = CallableFunction;

/** Base shape for immutable semantic descriptors emitted by builders. */
export interface Descriptor<Type extends string> {
  readonly kind: Type;
}

/** Public builder shape for APIs that expose their semantic descriptor. */
export interface DescriptorBuilder<
  SemanticDescriptor extends Descriptor<string>,
> {
  readonly descriptor: SemanticDescriptor;
}

/** Supported lifecycle component categories. */
export type LifecycleEntryKind =
  | "guard"
  | "filter"
  | "interceptor"
  | "pipe"
  | "provider";

/** Deterministic lifecycle configuration attached to a lifecycle builder. */
export type LifecycleEntryOptions = Readonly<Record<string, unknown>>;

/** Semantic descriptor for a reusable lifecycle component builder. */
export interface LifecycleEntry<
  Kind extends LifecycleEntryKind = LifecycleEntryKind,
> extends Descriptor<"lifecycle.entry"> {
  readonly entryKind: Kind;
  readonly name: string;
  readonly options?: LifecycleEntryOptions;
}

/** Semantic descriptor for a reusable lifecycle policy composition. */
export interface LifecycleCompositionDescriptor
  extends Descriptor<"lifecycle.composition"> {
  readonly entries: readonly LifecycleEntry[];
}

/** Any lifecycle descriptor or builder that can be merged into a policy. */
export type LifecycleSource =
  | LifecycleCompositionDescriptor
  | LifecycleEntry<LifecycleEntryKind>
  | DescriptorBuilder<LifecycleCompositionDescriptor>
  | DescriptorBuilder<LifecycleEntry<LifecycleEntryKind>>;

/** HTTP methods supported by route builders. */
export type HttpMethod =
  | "GET"
  | "POST"
  | "PUT"
  | "PATCH"
  | "DELETE"
  | "HEAD"
  | "OPTIONS";

/** Semantic descriptor for a single HTTP route. */
export interface HttpRouteDescriptor extends Descriptor<"http.route"> {
  readonly method: HttpMethod;
  readonly path: string;
  readonly handler: HandlerReference;
  readonly lifecycle: LifecycleCompositionDescriptor;
}

/** Semantic descriptor for a reusable HTTP controller. */
export interface HttpControllerDescriptor
  extends Descriptor<"http.controller"> {
  readonly path: string;
  readonly lifecycle: LifecycleCompositionDescriptor;
  readonly routes: readonly HttpRouteDescriptor[];
}
