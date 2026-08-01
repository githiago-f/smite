import { Option, extractorMetadata } from "@smite/fp";
import type { Extractor, ExtractorMetadata, ExtractorSource } from "@smite/fp";
import { freeze, freezeArray } from "../internal/freeze.js";
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
  HttpRouteDescriptor,
  LifecycleCompositionDescriptor,
  LifecycleSource,
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

export const createRouteDescriptor = (
  method: HttpMethod,
  path: string,
  handler: HandlerReference,
  lifecycle: LifecycleCompositionDescriptor = emptyLifecycleDescriptor(),
): HttpRouteDescriptor =>
  freeze({
    kind: "http.route",
    method,
    path,
    handler,
    lifecycle,
  });

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
  });

const route = (
  method: HttpMethod,
  path: string,
  handler: HandlerReference,
): HttpRouteBuilder =>
  createRouteBuilder(createRouteDescriptor(method, path, handler));

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
 * Extractor specialized to the HTTP execution context.
 *
 * @group HTTP
 */
export type HttpExtractor = Extractor<HttpExecutionContext, string>;

type HttpExtractorRead = (
  context: HttpExecutionContext,
) => string | null | undefined;

const createHttpExtractor = (
  source: ExtractorSource,
  key: string,
  read: HttpExtractorRead,
): HttpExtractor => {
  const extractor = ((context: HttpExecutionContext) =>
    Option.fromNullable(read(context))) as HttpExtractor;
  const metadata: ExtractorMetadata = freeze({
    kind: "fp.extractor",
    source,
    key,
  });

  Object.defineProperty(extractor, extractorMetadata, {
    configurable: false,
    enumerable: false,
    value: metadata,
  });

  return extractor;
};

const readHeaderValue = (
  request: HttpExecutionRequest,
  name: string,
): string | undefined => {
  for (const [key, value] of Object.entries(request.headers)) {
    if (key.toLowerCase() !== name.toLowerCase()) {
      continue;
    }

    if (typeof value === "string") {
      return value;
    }

    return Array.isArray(value) ? value[0] : undefined;
  }

  return undefined;
};

const readQueryValue = (
  request: HttpExecutionRequest,
  name: string,
): string | undefined => {
  const value = request.query[name];
  return typeof value === "string" ? value : undefined;
};

const readAuthorizationValue = (
  request: HttpExecutionRequest,
  scheme?: string,
): string | undefined => {
  const value = readHeaderValue(request, "authorization");
  if (value === undefined) {
    return undefined;
  }

  if (scheme === undefined) {
    return value;
  }

  const [actualScheme, ...rest] = value.trim().split(/\s+/u);
  if (actualScheme !== scheme) {
    return undefined;
  }

  const token = rest.join(" ");
  return token.length > 0 ? token : undefined;
};

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
  route: freeze({
    get: (path: string, handler: HandlerReference) =>
      route("GET", path, handler),
    post: (path: string, handler: HandlerReference) =>
      route("POST", path, handler),
    put: (path: string, handler: HandlerReference) =>
      route("PUT", path, handler),
    patch: (path: string, handler: HandlerReference) =>
      route("PATCH", path, handler),
    delete: (path: string, handler: HandlerReference) =>
      route("DELETE", path, handler),
    head: (path: string, handler: HandlerReference) =>
      route("HEAD", path, handler),
    options: (path: string, handler: HandlerReference) =>
      route("OPTIONS", path, handler),
  }),
  /**
   * Extracts a cookie value by name.
   *
   * The value is missing when the request does not carry the cookie.
   *
   * @group HTTP
   * @intent Reads a request cookie as an optional string.
   * @example Extract a cookie
   */
  cookie: (name: string): HttpExtractor =>
    createHttpExtractor(
      "cookie",
      name,
      (context) => context.request.cookies[name],
    ),
  /**
   * Extracts an HTTP header value by name.
   *
   * Header lookup is case-insensitive. Array-valued headers yield their first
   * element. The value is missing when the header is absent.
   *
   * @group HTTP
   * @intent Reads a request header as an optional string.
   * @example Extract a header
   */
  header: (name: string): HttpExtractor =>
    createHttpExtractor("header", name, (context) =>
      readHeaderValue(context.request, name),
    ),
  /**
   * Extracts a query parameter by name.
   *
   * Only string values are extracted; other query values are treated as
   * missing.
   *
   * @group HTTP
   * @intent Reads a URL query parameter as an optional string.
   * @example Extract a query parameter
   */
  query: (name: string): HttpExtractor =>
    createHttpExtractor("query", name, (context) =>
      readQueryValue(context.request, name),
    ),
  /**
   * Extracts a path parameter by name.
   *
   * The value is missing when the route does not declare the parameter.
   *
   * @group HTTP
   * @intent Reads a URL path parameter as an optional string.
   * @example Extract a path parameter
   */
  param: (name: string): HttpExtractor =>
    createHttpExtractor(
      "param",
      name,
      (context) => context.request.params[name],
    ),
  /**
   * Extracts a token from the Authorization header.
   *
   * When a scheme is provided, the header must match `"<scheme> <token>"`.
   * Without a scheme, the raw header value is returned.
   *
   * @group HTTP
   * @intent Reads an Authorization header value or token as an optional string.
   * @example Extract an authorization scheme
   */
  authHeader: (scheme?: string): HttpExtractor =>
    createHttpExtractor("authHeader", "authorization", (context) =>
      readAuthorizationValue(context.request, scheme),
    ),
  /**
   * Extracts a value with a custom reader.
   *
   * The reader receives the full execution context and returns a string or a
   * nullish value.
   *
   * @group HTTP
   * @intent Lets applications read request values not covered by built-in extractors.
   * @example Custom extractor
   */
  custom: (name: string, read: HttpExtractorRead): HttpExtractor =>
    createHttpExtractor("custom", name, read),
});
