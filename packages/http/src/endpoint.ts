import { defineDescriptor, relate } from "@smite/core";
import type { Descriptor } from "@smite/core";
import type { HttpHandler, HttpMethod, RouteInputConfig } from "./types.js";
import { withMethods } from "./withMethods.js";

declare const ALLOW_GLOBAL_REGISTRY: boolean;

/**
 * An endpoint node: a `method` + `path` pair on a route.
 *
 * @group DSL
 */
export interface EndpointDescriptor
  extends Descriptor<
    "http.endpoint",
    { readonly method: HttpMethod; readonly path: string }
  > {}

/**
 * A node wrapping the handler function for an endpoint.
 *
 * @group DSL
 */
export interface HandlerDescriptor
  extends Descriptor<"http.handler", { readonly fn: HttpHandler }> {}

/**
 * An endpoint reference: the endpoint IR node carrying its `handler` method.
 *
 * @group DSL
 */
export interface HttpEndpointBuilder<
  Config extends RouteInputConfig = RouteInputConfig,
> extends EndpointDescriptor {
  readonly handler: (fn: HttpHandler<Config>) => void;
}

const DOMAIN_HANDLER = Symbol.for("@smite/domain/handler");

type DomainHandlerRef = { readonly usecaseNode: Descriptor<string, unknown> };

const relateDomainUsecase = <Config extends RouteInputConfig>(
  handler: HandlerDescriptor,
  fn: HttpHandler<Config>,
): void => {
  if (typeof ALLOW_GLOBAL_REGISTRY !== "boolean" || !ALLOW_GLOBAL_REGISTRY)
    return;
  const ref = (fn as unknown as Record<PropertyKey, unknown>)[DOMAIN_HANDLER] as
    | DomainHandlerRef
    | undefined;
  const usecase = ref?.usecaseNode;
  if (usecase !== undefined) {
    relate(handler, "domain.usecase", usecase);
  }
};

/**
 * Declares an endpoint (method + path) on a route and returns a builder for
 * its handler.
 *
 * @group DSL
 * @example Add endpoints and handlers
 */
export function accept<Config extends RouteInputConfig>(
  route: Descriptor<"http.route", { req?: RouteInputConfig }>,
  method: HttpMethod,
  path: string,
): HttpEndpointBuilder<Config> {
  const descriptor = defineDescriptor("http.endpoint", `${method} ${path}`, {
    method,
    path,
  });

  relate(route, "http.endpoint", descriptor);

  return withMethods(descriptor, {
    handler: (fn: HttpHandler<Config>) => {
      const handler = defineDescriptor(
        "http.handler",
        `http.handler:${descriptor.__key}`,
        { fn },
      );
      relate(descriptor, "http.handler", handler);
      relateDomainUsecase(handler, fn);
    },
  });
}
