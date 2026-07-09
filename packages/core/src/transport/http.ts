import { Option, extractorMetadata } from "@smite/fp";
import type { Extractor, ExtractorMetadata, ExtractorSource } from "@smite/fp";
import { freeze, freezeArray } from "../internal/freeze.js";
import { lifecycle } from "../lifecycle/lifecycle.js";
import {
  emptyLifecycleDescriptor,
  mergeLifecycleDescriptors,
} from "../lifecycle/merge.js";
import type {
  HandlerReference,
  HttpControllerDescriptor,
  HttpExecutionContext,
  HttpExecutionRequest,
  HttpMethod,
  HttpResult,
  HttpRouteDescriptor,
  LifecycleCompositionDescriptor,
  LifecycleSource,
  RouteInputConfig,
  RouteOutputConfig,
  RouteSpecBuilder,
  RouteSpecDescriptor,
} from "../types.js";

/**
 * Immutable builder for an HTTP route descriptor.
 *
 * @group HTTP
 * @intent Captures a method, path, handler reference and route-specific lifecycle policy.
 * @example Route-specific lifecycle
 */
export interface HttpRouteBuilder {
  readonly descriptor: HttpRouteDescriptor;
  readonly use: (...sources: readonly LifecycleSource[]) => HttpRouteBuilder;
  readonly input: (config: RouteInputConfig) => HttpRouteBuilder;
  readonly output: (config: RouteOutputConfig) => HttpRouteBuilder;
  readonly extend: (spec: RouteSpecBuilder) => HttpRouteBuilder;
}

/**
 * Immutable builder for an HTTP controller descriptor.
 *
 * @group HTTP
 * @intent Groups HTTP routes under a path while preserving reusable lifecycle policy.
 * @example HTTP controller with lifecycle
 * @example Immutable builder derivation
 */
export interface HttpControllerBuilder {
  readonly descriptor: HttpControllerDescriptor;
  readonly use: (
    ...sources: readonly LifecycleSource[]
  ) => HttpControllerBuilder;
  readonly path: (path: string) => HttpControllerBuilder;
  readonly routes: (
    ...routes: readonly HttpRouteBuilder[]
  ) => HttpControllerBuilder;
}

export interface RouteConfigurator {
  readonly get: (
    path: string,
    handler: HandlerReference,
  ) => HttpRouteBuilder;
  readonly post: (
    path: string,
    handler: HandlerReference,
  ) => HttpRouteBuilder;
  readonly put: (
    path: string,
    handler: HandlerReference,
  ) => HttpRouteBuilder;
  readonly patch: (
    path: string,
    handler: HandlerReference,
  ) => HttpRouteBuilder;
  readonly delete: (
    path: string,
    handler: HandlerReference,
  ) => HttpRouteBuilder;
  readonly head: (
    path: string,
    handler: HandlerReference,
  ) => HttpRouteBuilder;
  readonly options: (
    path: string,
    handler: HandlerReference,
  ) => HttpRouteBuilder;
  readonly input: (config: RouteInputConfig) => RouteSpecBuilder;
  readonly output: (config: RouteOutputConfig) => RouteSpecBuilder;
  readonly extend: (spec: RouteSpecBuilder) => RouteConfigurator;
}

const createRouteDescriptor = (
  method: HttpMethod,
  path: string,
  handler: HandlerReference,
  lifecycle: LifecycleCompositionDescriptor = emptyLifecycleDescriptor(),
  input?: RouteInputConfig,
  output?: RouteOutputConfig,
): HttpRouteDescriptor =>
  freeze({
    kind: "http.route",
    method,
    path,
    handler,
    lifecycle,
    ...(input !== undefined ? { input } : {}),
    ...(output !== undefined ? { output } : {}),
  });

const createLifecycleEntryFromInput = (
  config: RouteInputConfig,
): readonly LifecycleSource[] => {
  const sources: LifecycleSource[] = [];

  if (config.params) {
    const schema = config.params;
    sources.push(
      lifecycle.guard("input-params", ((context: HttpExecutionContext) => {
        try {
          schema.parse(context.request.params);
          return true;
        } catch {
          return false;
        }
      }) as (...args: readonly unknown[]) => boolean),
    );
  }

  if (config.query) {
    const schema = config.query;
    sources.push(
      lifecycle.guard("input-query", ((context: HttpExecutionContext) => {
        try {
          schema.parse(context.request.query);
          return true;
        } catch {
          return false;
        }
      }) as (...args: readonly unknown[]) => boolean),
    );
  }

  if (config.headers) {
    const schema = config.headers;
    sources.push(
      lifecycle.guard("input-headers", ((context: HttpExecutionContext) => {
        try {
          schema.parse(context.request.headers);
          return true;
        } catch {
          return false;
        }
      }) as (...args: readonly unknown[]) => boolean),
    );
  }

  if (config.body) {
    const schema = config.body;
    sources.push(
      lifecycle.pipe("input-body", ((body: unknown) =>
        schema.parse(body)) as (...args: readonly unknown[]) => unknown),
    );
  }

  return sources;
};

const createRouteBuilder = (
  descriptor: HttpRouteDescriptor,
): HttpRouteBuilder =>
  freeze({
    descriptor,
    use: (...sources) =>
      createRouteBuilder({
        ...descriptor,
        lifecycle: mergeLifecycleDescriptors(descriptor.lifecycle, ...sources),
      }),
    input: (config) => {
      const merged = mergeLifecycleDescriptors(
        descriptor.lifecycle,
        ...createLifecycleEntryFromInput(config),
      );

      return createRouteBuilder({
        ...descriptor,
        input: freeze({ ...config }),
        lifecycle: merged,
      });
    },
    output: (config) =>
      createRouteBuilder({
        ...descriptor,
        output: freeze({ ...config }),
      }),
    extend: (spec) => {
      const specDescriptor = spec.descriptor;
      let result = createRouteBuilder(descriptor);

      if (specDescriptor.input) {
        result = result.input(specDescriptor.input);
      }

      if (specDescriptor.output) {
        result = result.output(specDescriptor.output);
      }

      return result;
    },
  });

const route = (
  method: HttpMethod,
  path: string,
  handler: HandlerReference,
): HttpRouteBuilder =>
  createRouteBuilder(createRouteDescriptor(method, path, handler));

const createSpecDescriptor = (
  input?: RouteInputConfig,
  output?: RouteOutputConfig,
): RouteSpecDescriptor =>
  freeze({
    kind: "http.spec",
    ...(input ? { input: freeze({ ...input }) } : {}),
    ...(output ? { output: freeze({ ...output }) } : {}),
    lifecycle: emptyLifecycleDescriptor(),
  });

const createSpecBuilder = (
  descriptor: RouteSpecDescriptor,
): RouteSpecBuilder =>
  freeze({
    descriptor,
    input: (config) =>
      createSpecBuilder(
        createSpecDescriptor(config, descriptor.output),
      ),
    output: (config) =>
      createSpecBuilder(
        createSpecDescriptor(descriptor.input, config),
      ),
  });

const createRouteConfigurator = (
  spec?: RouteSpecDescriptor,
): RouteConfigurator => {
  const verb =
    (method: HttpMethod) =>
    (path: string, handler: HandlerReference): HttpRouteBuilder => {
      let routeBuilder = route(method, path, handler);

      if (spec) {
        if (spec.input) {
          routeBuilder = routeBuilder.input(spec.input);
        }

        if (spec.output) {
          routeBuilder = routeBuilder.output(spec.output);
        }
      }

      return routeBuilder;
    };

  return freeze({
    get: verb("GET"),
    post: verb("POST"),
    put: verb("PUT"),
    patch: verb("PATCH"),
    delete: verb("DELETE"),
    head: verb("HEAD"),
    options: verb("OPTIONS"),
    input: (config) => createSpecBuilder(createSpecDescriptor(config)),
    output: (config) => createSpecBuilder(createSpecDescriptor(undefined, config)),
    extend: (specBuilder) => createRouteConfigurator(specBuilder.descriptor),
  });
};

const createControllerBuilder = (
  descriptor: HttpControllerDescriptor,
): HttpControllerBuilder =>
  freeze({
    descriptor,
    use: (...sources) =>
      createControllerBuilder({
        ...descriptor,
        lifecycle: mergeLifecycleDescriptors(descriptor.lifecycle, ...sources),
      }),
    path: (path) =>
      createControllerBuilder({
        ...descriptor,
        path,
      }),
    routes: (...routes) =>
      createControllerBuilder({
        ...descriptor,
        routes: freezeArray(routes.map((builder) => builder.descriptor)),
      }),
  });

/**
 * Creates an {@link HttpResult} that the pipeline recognises and
 * normalises into an {@link HttpExecutionResult}.
 *
 * @group HTTP
 */
const createHttpResult = (
  status: number,
  body?: unknown,
  headers?: Readonly<Record<string, string>>,
): HttpResult =>
  freeze({
    kind: "http.result",
    status,
    ...(body !== undefined ? { body } : {}),
    ...(headers !== undefined ? { headers } : {}),
  });

/**
 * Namespace for HTTP transport builders.
 *
 * HTTP builders describe controllers and routes as semantic metadata. They do
 * not register servers, open ports or construct runtime pipelines.
 *
 * @group HTTP
 * @intent Public namespace for declaring HTTP controllers and routes as compile-time descriptors.
 * @example HTTP controller with lifecycle
 * @example Route-specific lifecycle
 */
export const http = freeze({
  controller: (): HttpControllerBuilder =>
    createControllerBuilder(
      freeze({
        kind: "http.controller",
        path: "",
        lifecycle: emptyLifecycleDescriptor(),
        routes: freezeArray([]),
      }),
    ),
  route: createRouteConfigurator(),
  result: createHttpResult,

  /** HTTP status constants */
  OK: 200 as const,
  CREATED: 201 as const,
  ACCEPTED: 202 as const,
  NO_CONTENT: 204 as const,
  MOVED_PERMANENTLY: 301 as const,
  FOUND: 302 as const,
  NOT_MODIFIED: 304 as const,
  BAD_REQUEST: 400 as const,
  UNAUTHORIZED: 401 as const,
  FORBIDDEN: 403 as const,
  NOT_FOUND: 404 as const,
  METHOD_NOT_ALLOWED: 405 as const,
  CONFLICT: 409 as const,
  UNSUPPORTED_MEDIA_TYPE: 415 as const,
  UNPROCESSABLE_ENTITY: 422 as const,
  TOO_MANY_REQUESTS: 429 as const,
  INTERNAL_SERVER_ERROR: 500 as const,
  BAD_GATEWAY: 502 as const,
  SERVICE_UNAVAILABLE: 503 as const,
});
