import { childrenOf, finalizeDescriptor } from "@smitejs/core";
import type { AppDescriptor, Descriptor } from "@smitejs/core";
import { match } from "path-to-regexp";
import type {
  HttpHandler,
  HttpHandlerContext,
  HttpMethod,
  HttpRequest,
  HttpResponse,
  RouteInputConfig,
} from "./types.js";
import { validate } from "./validate.js";

/** Runtime request handler produced by `serve`. @group Executor */
export type HttpRouter = (request: HttpRequest) => Promise<HttpResponse>;

type RouteNode = Descriptor<"http.route", { req?: RouteInputConfig }>;
type EndpointNode = Descriptor<
  "http.endpoint",
  { method: HttpMethod; path: string }
>;

const toResponse = (result: unknown): HttpResponse => {
  if (result !== null && typeof result === "object" && "status" in result) {
    return result as HttpResponse;
  }
  return { status: 200, body: result };
};

/**
 * Turns an app descriptor into a runtime request handler. Walks the IR via
 * child refs, never the registry, and finalizes (deep-freezes) the graph
 * before dispatching.
 *
 * @group Executor
 * @example Serve a request
 */
export function serve(app: AppDescriptor): HttpRouter {
  finalizeDescriptor(app);

  const routes = childrenOf(app, "http.route");
  const matchers = routes.flatMap((route) => {
    const routeNode = route as RouteNode;
    return childrenOf(routeNode, "http.endpoint").map((endpoint) => {
      const endpointNode = endpoint as EndpointNode;
      return {
        endpoint: endpointNode,
        config: routeNode.data.req,
        match: match(endpointNode.data.path, { decode: decodeURIComponent }),
      };
    });
  });

  return async (request) => {
    for (const { endpoint, config, match: matchPath } of matchers) {
      const result = matchPath(request.path);
      if (result === false) continue;
      if (
        endpoint.data.method !== "ANY" &&
        endpoint.data.method !== request.method.toUpperCase()
      ) {
        continue;
      }

      const input = {
        params: result.params as Readonly<Record<string, string>>,
        query: request.query ?? {},
        headers: request.headers ?? {},
        body: request.body,
      };

      const validated = validate(config, input);
      if (validated.error) {
        return { status: 400, body: { error: validated.error } };
      }

      const [handlerNode] = childrenOf(
        endpoint,
        "http.handler",
      ) as readonly Descriptor<"http.handler", { fn: HttpHandler }>[];
      if (handlerNode === undefined) {
        return { status: 404, body: { error: "Not Found" } };
      }

      const ctx = {
        request,
        query: validated.data.query,
        params: validated.data.params,
        headers: validated.data.headers,
        body: validated.data.body,
      } as HttpHandlerContext<RouteInputConfig>;

      return toResponse(await handlerNode.data.fn(ctx));
    }

    return { status: 404, body: { error: "Not Found" } };
  };
}
