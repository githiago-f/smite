import { childrenOf, finalizeDescriptor, runWithScope } from "@smitejs/core";
import type { AppDescriptor, Descriptor, ScopeContext } from "@smitejs/core";
import { match } from "path-to-regexp";
import { aspectsOf } from "./aspects.js";
import type {
  HttpAspect,
  HttpFilter,
  HttpGuard,
  HttpInterceptor,
  HttpMiddleware,
  HttpMiddlewareContext,
} from "./aspects.js";
import { compose } from "./middleware.js";
import { mergeRequestConfig } from "./request-config.js";
import type {
  HttpHandler,
  HttpMethod,
  HttpRequest,
  HttpResponse,
  RouteInputConfig,
} from "./types.js";
import { validate } from "./validate.js";

/** Runtime request handler produced by `serve`. @group Executor */
export type HttpRouter = (request: HttpRequest) => Promise<HttpResponse>;

type RouteNode = Descriptor<
  "http.route",
  { name?: string; req?: RouteInputConfig }
>;
type EndpointNode = Descriptor<
  "http.endpoint",
  { method: HttpMethod; path: string; req?: RouteInputConfig }
>;
type Matcher = {
  readonly endpoint: EndpointNode;
  readonly config: RouteInputConfig | undefined;
  readonly match: (path: string) => { params: object } | false;
};

const toResponse = (result: unknown): HttpResponse => {
  if (result !== null && typeof result === "object" && "status" in result) {
    return result as HttpResponse;
  }
  return { status: 200, body: result };
};

const route = async (
  matchers: readonly Matcher[],
  request: HttpRequest,
): Promise<HttpResponse> => {
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
    } as HttpHandlerContextLike;

    return toResponse(await handlerNode.data.fn(ctx));
  }

  return { status: 404, body: { error: "Not Found" } };
};

type HttpHandlerContextLike = {
  readonly request: HttpRequest;
  readonly query: unknown;
  readonly params: unknown;
  readonly headers: unknown;
  readonly body: unknown;
};

/**
 * Options for {@link serve}: scope the router to a subset of the app's named
 * routers.
 *
 * @group Executor
 */
export interface ServeOptions {
  /** Only serve these named routers; all other routes return 404. */
  readonly routers?: readonly string[];
}

const isShortCircuit = (
  value: HttpResponse | undefined,
): value is HttpResponse => value !== undefined && value !== null;

const buildPipeline = (
  aspects: readonly HttpAspect[],
  dispatch: (ctx: HttpMiddlewareContext) => Promise<HttpResponse>,
): ((ctx: HttpMiddlewareContext) => Promise<HttpResponse>) => {
  let pipeline = dispatch;

  const filters = aspects.filter(
    (aspect): aspect is HttpAspect & { fn: HttpFilter } =>
      aspect.kind === "filter",
  );
  if (filters.length > 0) {
    const inner = pipeline;
    pipeline = async (ctx) => {
      let response = await inner(ctx);
      for (const filter of filters) {
        response = await filter.fn(response, ctx);
      }
      return response;
    };
  }

  const guards = aspects.filter(
    (aspect): aspect is HttpAspect & { fn: HttpGuard } =>
      aspect.kind === "guard",
  );
  if (guards.length > 0) {
    const inner = pipeline;
    pipeline = async (ctx) => {
      for (const guard of guards) {
        const result = await guard.fn(ctx);
        if (isShortCircuit(result)) return result;
      }
      return inner(ctx);
    };
  }

  const stages = aspects.filter(
    (aspect): aspect is HttpAspect & { fn: HttpMiddleware | HttpInterceptor } =>
      aspect.kind === "middleware" || aspect.kind === "interceptor",
  );
  if (stages.length > 0) {
    pipeline = compose(
      stages.map((aspect) => aspect.fn),
      pipeline,
    );
  }

  return pipeline;
};

/**
 * Turns an app descriptor into a runtime request handler. Walks the IR via
 * child refs, never the registry, and finalizes (deep-freezes) the graph
 * before dispatching. Each request runs inside an AsyncLocalStorage scope so
 * aspects and handlers can observe request context. Pipeline order follows
 * registration: interceptors/middleware wrap, guards gate, the matched
 * handler runs, then response filters post-process.
 *
 * @group Executor
 * @example Serve a request
 */
export function serve(
  app: AppDescriptor,
  options: ServeOptions = {},
): HttpRouter {
  finalizeDescriptor(app);

  const matchers = childrenOf(app, "http.route").flatMap((route) => {
    const routeNode = route as RouteNode;
    if (
      options.routers !== undefined &&
      (routeNode.data.name === undefined ||
        !options.routers.includes(routeNode.data.name))
    ) {
      return [];
    }
    return childrenOf(routeNode, "http.endpoint").map((endpoint) => {
      const endpointNode = endpoint as EndpointNode;
      return {
        endpoint: endpointNode,
        config: mergeRequestConfig(routeNode.data.req, endpointNode.data.req),
        match: match(endpointNode.data.path, { decode: decodeURIComponent }),
      };
    });
  });

  const pipeline = buildPipeline(aspectsOf(app), (ctx) =>
    route(matchers, ctx.request),
  );

  return async (request) => {
    const scope: ScopeContext = { request };
    return runWithScope(scope, () => {
      const ctx: HttpMiddlewareContext = { request, scope };
      return pipeline(ctx);
    });
  };
}
