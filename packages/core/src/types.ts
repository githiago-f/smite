/**
 * A callable application handler referenced by transport descriptors.
 *
 * @group Descriptors
 * @intent Keeps business handlers opaque to the builder layer.
 */
export type HandlerReference = CallableFunction;

/**
 * Base shape for immutable semantic descriptors emitted by builders.
 *
 * @group Descriptors
 * @intent Gives the compiler a discriminant for every semantic object.
 */
export interface Descriptor<Type extends string> {
  readonly kind: Type;
}

/**
 * Public builder shape for APIs that expose their semantic descriptor.
 *
 * @group Descriptors
 * @intent Makes builders inspectable by the compiler without requiring runtime execution.
 */
export interface DescriptorBuilder<
  SemanticDescriptor extends Descriptor<string>,
> {
  readonly descriptor: SemanticDescriptor;
}

/**
 * Supported lifecycle component categories.
 *
 * @group Lifecycle
 * @intent Defines the execution-policy vocabulary shared across transports.
 */
export type LifecycleEntryKind =
  | "guard"
  | "filter"
  | "interceptor"
  | "pipe"
  | "provider";

/**
 * Deterministic lifecycle configuration attached to a lifecycle builder.
 *
 * @group Lifecycle
 * @intent Stores compile-time options beside explicit runtime implementation references.
 */
export type LifecycleEntryOptions = Readonly<Record<string, unknown>>;

/**
 * Runtime behavior referenced by a lifecycle builder.
 *
 * @group Lifecycle
 * @intent Lets generated runtimes execute lifecycle behavior without requiring builders to run it.
 */
export type LifecycleEntryImplementation = CallableFunction;

/**
 * Semantic descriptor for a reusable lifecycle component builder.
 *
 * @group Lifecycle
 * @intent Represents one named execution concern such as a guard, pipe or provider.
 * @example Lifecycle adapters
 */
export interface LifecycleEntry<
  Kind extends LifecycleEntryKind = LifecycleEntryKind,
> extends Descriptor<"lifecycle.entry"> {
  readonly entryKind: Kind;
  readonly name: string;
  readonly implementation?: LifecycleEntryImplementation;
  readonly options?: LifecycleEntryOptions;
}

/**
 * Semantic descriptor for a reusable lifecycle policy composition.
 *
 * @group Lifecycle
 * @intent Provides the compiler with the ordered lifecycle policy to merge into transports.
 * @example Reusable lifecycle composition
 */
export interface LifecycleCompositionDescriptor
  extends Descriptor<"lifecycle.composition"> {
  readonly entries: readonly LifecycleEntry[];
}

/**
 * Any lifecycle descriptor or builder that can be merged into a policy.
 *
 * @group Lifecycle
 * @intent Lets APIs accept both direct descriptors and reusable builders while normalizing during compilation.
 */
export type LifecycleSource =
  | LifecycleCompositionDescriptor
  | LifecycleEntry<LifecycleEntryKind>
  | DescriptorBuilder<LifecycleCompositionDescriptor>
  | DescriptorBuilder<LifecycleEntry<LifecycleEntryKind>>;

/**
 * HTTP methods supported by route builders.
 *
 * @group HTTP
 * @intent Restricts route descriptors to methods understood by HTTP compiler plugins.
 */
export type HttpMethod =
  | "GET"
  | "POST"
  | "PUT"
  | "PATCH"
  | "DELETE"
  | "HEAD"
  | "OPTIONS";

/**
 * Semantic descriptor for a single HTTP route.
 *
 * @group HTTP
 * @intent Carries all route semantics needed by runtime, OpenAPI and infrastructure generators.
 * @example Route-specific lifecycle
 */
export interface HttpRouteDescriptor extends Descriptor<"http.route"> {
  readonly method: HttpMethod;
  readonly path: string;
  readonly handler: HandlerReference;
  readonly lifecycle: LifecycleCompositionDescriptor;
}

/**
 * Semantic descriptor for a reusable HTTP controller.
 *
 * @group HTTP
 * @intent Groups route descriptors and shared lifecycle policy without introducing an application object.
 * @example HTTP controller with lifecycle
 */
export interface HttpControllerDescriptor
  extends Descriptor<"http.controller"> {
  readonly path: string;
  readonly lifecycle: LifecycleCompositionDescriptor;
  readonly routes: readonly HttpRouteDescriptor[];
}

/**
 * Normalized HTTP request consumed by core execution.
 *
 * @group HTTP
 * @intent Lets runtime adapters translate platform-specific requests into one executable core shape.
 */
export interface HttpExecutionRequest {
  readonly method: string;
  readonly path: string;
  readonly headers: Readonly<
    Record<string, string | readonly string[] | undefined>
  >;
  readonly cookies: Readonly<Record<string, string>>;
  readonly query: Readonly<Record<string, unknown>>;
  readonly params: Readonly<Record<string, string>>;
  readonly body: unknown;
  readonly raw: unknown;
}

/**
 * Execution context passed through lifecycle components and handlers.
 *
 * @group HTTP
 * @intent Keeps lifecycle ordering in core while adapters only translate input and output.
 */
export interface HttpExecutionContext {
  readonly request: HttpExecutionRequest;
  readonly state: Readonly<Record<string, unknown>>;
}

/**
 * Normalized HTTP response produced by core execution.
 *
 * @group HTTP
 * @intent Gives runtime adapters one result shape to serialize for their platform.
 */
export interface HttpExecutionResult {
  readonly status?: number;
  readonly headers?: Readonly<Record<string, string>>;
  readonly body?: unknown;
}

export type HttpHandlerResult = HttpExecutionResult | unknown;

export type HttpRuntimeFunction = (
  ...args: readonly unknown[]
) => unknown | Promise<unknown>;

/**
 * Semantic descriptor for a reusable messaging consumer.
 *
 * @group Messaging
 * @intent Captures queue binding, handler reference and lifecycle policy for message-driven execution.
 * @example Messaging consumer with lifecycle
 */
export interface MessagingConsumerDescriptor
  extends Descriptor<"messaging.consumer"> {
  readonly queue: string;
  readonly handler?: HandlerReference;
  readonly lifecycle: LifecycleCompositionDescriptor;
}

/**
 * Semantic descriptor for a scheduled job.
 *
 * @group Scheduler
 * @intent Captures the schedule expression, handler reference and lifecycle policy for time-driven execution.
 * @example Scheduled job with lifecycle
 */
export interface SchedulerJobDescriptor extends Descriptor<"scheduler.job"> {
  readonly cron: string;
  readonly handler?: HandlerReference;
  readonly lifecycle: LifecycleCompositionDescriptor;
}
