import { freeze, freezeArray } from "../internal/freeze.js";
import {
  emptyLifecycleDescriptor,
  mergeLifecycleDescriptors,
} from "../lifecycle/merge.js";
import type {
  HandlerReference,
  HttpControllerDescriptor,
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

const createRouteDescriptor = (
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
});
