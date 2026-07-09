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
 * Common HTTP status codes as a numeric union.
 *
 * @group HTTP
 * @intent Provides autocomplete-friendly status constants for builders and handlers.
 */
export type HttpStatusCode =
  | 200 | 201 | 202 | 204
  | 301 | 302 | 304
  | 400 | 401 | 403 | 404 | 405 | 409 | 415 | 422 | 429
  | 500 | 502 | 503;

/**
 * Validating schema with a known output type.
 *
 * Library-agnostic — any schema library that exposes a `parse` function
 * (Zod, Valibot, ArkType, io-ts) satisfies this interface.
 *
 * @group HTTP
 * @intent Keeps schema validation pluggable while letting the compiler infer types.
 */
export interface InputSchema<out T = unknown> {
  readonly parse: (input: unknown) => T;
}

/**
 * Extracts the inferred output type from an {@link InputSchema}.
 *
 * @group HTTP
 */
export type TypeOfInputSchema<T> = T extends InputSchema<infer O> ? O : unknown;

/**
 * Declarative input specification for an HTTP route or spec.
 *
 * Each optional field binds a Zod-compatible schema to a request
 * bucket. The builder automatically generates lifecycle entries that
 * validate and transform at execution time.
 *
 * @group HTTP
 * @intent Lets route authors declare what data enters the handler without
 * writing validation plumbing.
 */
export interface RouteInputConfig {
  readonly params?: InputSchema;
  readonly query?: InputSchema;
  readonly headers?: InputSchema;
  readonly body?: InputSchema;
}

/**
 * Declarative output specification for an HTTP route or spec.
 *
 * Maps HTTP status codes to response body schemas. Consumed by
 * artifact generators (OpenAPI, SDKs); no runtime validation.
 *
 * @group HTTP
 * @intent Gives documentation and code-gen tools a complete picture of the
 * route contract without executing the handler.
 */
export type RouteOutputConfig = Readonly<Record<number, InputSchema>>;

/**
 * Recognised return value from route handlers.
 *
 * When a handler returns an `HttpResult` the pipeline normalises it
 * directly into {@link HttpExecutionResult} instead of wrapping it as
 * the response body.
 *
 * @group HTTP
 * @intent Lets handlers return structured HTTP responses without coupling
 * the handler to the pipeline's return type.
 */
export interface HttpResult {
  readonly kind: "http.result";
  readonly status: number;
  readonly body?: unknown;
  readonly headers?: Readonly<Record<string, string>>;
}

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
  readonly input?: Readonly<RouteInputConfig>;
  readonly output?: Readonly<RouteOutputConfig>;
}

/**
 * Semantic descriptor for a route specification (partial route config).
 *
 * A spec carries input/output schemas and optionally lifecycle entries
 * but has no verb, path or handler. It is applied to concrete routes
 * via {@link extend}.
 *
 * @group HTTP
 * @intent Lets authors define reusable interface contracts that multiple
 * routes can extend without repeating schema declarations.
 */
export interface RouteSpecDescriptor extends Descriptor<"http.spec"> {
  readonly input?: Readonly<RouteInputConfig>;
  readonly output?: Readonly<RouteOutputConfig>;
  readonly lifecycle: LifecycleCompositionDescriptor;
}

/**
 * Builder for a route specification.
 *
 * Returned by {@link http.route.input} and {@link http.route.output}
 * when no verb has been attached yet.
 *
 * @group HTTP
 * @intent Lets authors chain input/output declarations into a reusable spec.
 */
export interface RouteSpecBuilder {
  readonly descriptor: RouteSpecDescriptor;
  readonly input: (config: RouteInputConfig) => RouteSpecBuilder;
  readonly output: (config: RouteOutputConfig) => RouteSpecBuilder;
}

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
 * Infers the handler context type from a {@link RouteInputConfig}.
 *
 * Each schema bucket is narrowed to its inferred output type so that
 * handlers access validated data without casting.
 *
 * @group HTTP
 * @intent Bridges the gap between schema-declared input and handler contracts,
 * keeping the annotation explicit but the inference automatic.
 */
export type RouteHandlerContext<Input extends RouteInputConfig> =
  HttpExecutionContext & {
    readonly request: {
      readonly params: Input extends { params: InputSchema<infer T> }
        ? T
        : Readonly<Record<string, string>>;
      readonly query: Input extends { query: InputSchema<infer T> }
        ? T
        : Readonly<Record<string, unknown>>;
      readonly headers: Input extends { headers: InputSchema<infer T> }
        ? T
        : Readonly<Record<string, string | readonly string[] | undefined>>;
      readonly body: Input extends { body: InputSchema<infer T> }
        ? T
        : unknown;
    } & Omit<
      HttpExecutionRequest,
      "params" | "query" | "headers" | "body"
    >;
  };

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

/**
 * Semantic descriptor for a Smite application — an aggregate of all
 * components (controllers, consumers, jobs) that a runtime adapter
 * can consume.
 *
 * @group Application
 * @intent Provides a single, predictable entry point for runtime adapters.
 */
export interface ApplicationDescriptor
  extends Descriptor<"smite.application"> {
  readonly controllers: readonly HttpControllerDescriptor[];
  readonly consumers: readonly MessagingConsumerDescriptor[];
  readonly jobs: readonly SchedulerJobDescriptor[];
}
