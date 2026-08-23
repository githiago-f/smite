import { createApp } from "@smitejs/core";
import type { AppDescriptor } from "@smitejs/core";
import { chain, getExtractorMetadata } from "@smitejs/fp";
import { addAspect, aspect } from "./aspects.js";
import type { HttpAspect } from "./aspects.js";
import { cookies, headers, params, query } from "./extract.js";
import { currentLogger, requestLogger } from "./middleware.js";
import { serveNode } from "./node-server.js";
import { json, status } from "./response.js";
import { materializeRoute, methods, router } from "./router.js";
import type { HttpRouterBuilder } from "./router.js";
import { serve } from "./serve.js";
import type { HttpRouter } from "./serve.js";
import { withMethods } from "./withMethods.js";

export { HttpMethod, HttpStatus } from "./types.js";
export type { RouteConfig } from "./types.js";

export type {
  HttpRouteBuilder,
  HttpRouterBuilder,
  RouteDescriptor,
} from "./router.js";
export { router, methods } from "./router.js";

export { accept } from "./endpoint.js";
export type {
  EndpointPlan,
  HttpEndpointBuilder,
} from "./endpoint.js";

export { aspect } from "./aspects.js";
export type {
  HttpAspect,
  HttpAspectKind,
  HttpFilter,
  HttpGuard,
  HttpInterceptor,
  HttpMiddleware,
  HttpMiddlewareContext,
} from "./aspects.js";

export { compose, currentLogger, requestLogger } from "./middleware.js";
export type { RequestLogger, RequestLoggerOptions } from "./middleware.js";

export { json, status } from "./response.js";
export { serve } from "./serve.js";
export type { HttpRouter, ServeOptions } from "./serve.js";

export { serveNode } from "./node-server.js";
export type { NodeServerDocs, NodeServerOptions } from "./node-server.js";

export { routesOf } from "./routes.js";
export type { CollectedEndpoint, CollectedRoute } from "./routes.js";
export { mergeRequestConfig } from "./request-config.js";
export type { MergeRequestConfig } from "./types.js";

export { cookies, headers, params, query } from "./extract.js";
export { chain, getExtractorMetadata } from "@smitejs/fp";
export type { Extractor, ExtractorMetadata } from "@smitejs/fp";

/**
 * An app reference: the `app` IR node carrying its `use` and `serve` methods.
 * `use` injects router builders and AOP aspects; pass the reference around,
 * never reach into descriptor internals.
 *
 * @group DSL
 * @example Define an app with routes
 */
export interface HttpAppBuilder extends AppDescriptor {
  readonly use: (...injectables: HttpInjectable[]) => HttpAppBuilder;
  readonly serve: () => HttpRouter;
}

/** Anything `app.use` accepts: an AOP aspect or an injectable route builder. @group DSL */
export type HttpInjectable = HttpAspect | HttpRouterBuilder;

const isAspect = (value: HttpInjectable): value is HttpAspect =>
  "kind" in value && typeof value.fn === "function";

/**
 * Creates an HTTP app junction. The returned reference is the app descriptor
 * with the DSL attached, so `serve(app)` takes it directly. Inject standalone
 * route builders and aspects with `use(...)`.
 *
 * @group DSL
 * @example Compose a deployable HTTP app
 */
export function app(name?: string): HttpAppBuilder {
  const descriptor = createApp(name);
  const builder = withMethods(descriptor, {
    use: (...injectables: HttpInjectable[]) => {
      for (const injectable of injectables) {
        if (isAspect(injectable)) {
          addAspect(builder, injectable);
        } else {
          materializeRoute(builder, injectable);
        }
      }
      return builder;
    },
    serve: () => serve(builder),
  }) as HttpAppBuilder;
  return builder;
}

/**
 * The HTTP DSL surface: `app`, `router`, `methods`, `aspect`, `json`, `status`.
 *
 * @group DSL
 * @example Define an app with routes
 */
export const http = {
  app,
  router,
  methods,
  aspect,
  json,
  status,
  serve,
  serveNode,
  requestLogger,
  currentLogger,
  cookies,
  headers,
  params,
  query,
  chain,
  getExtractorMetadata,
};

export type {
  HttpHandler,
  HttpHandlerContext,
  HttpRequest,
  HttpResponse,
  InferBucket,
  RouteInputConfig,
} from "./types.js";
