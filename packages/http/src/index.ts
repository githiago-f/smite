import {
  childrenOf,
  createApp,
  defineDescriptor,
  refine,
  relate,
} from "@smitejs/core";
import type { AppDescriptor, Descriptor } from "@smitejs/core";
import { chain, getExtractorMetadata } from "@smitejs/fp";
import { accept } from "./endpoint.js";
import type { HttpEndpointBuilder } from "./endpoint.js";
import { cookies, headers, params, query } from "./extract.js";
import { serveNode } from "./node-server.js";
import { json, status } from "./response.js";
import { serve } from "./serve.js";
import type { HttpRouter } from "./serve.js";
import type { HttpMethod, RouteConfig, RouteInputConfig } from "./types.js";
import { withMethods } from "./withMethods.js";

export { HttpMethod, HttpStatus } from "./types.js";
export type { RouteConfig } from "./types.js";

/**
 * A route node in the IR, holding its optional descriptive `config` fields and
 * `req` input config. The key is scoped to its app, so routes are unique
 * within one app, not across the whole application.
 *
 * @group DSL
 */
export interface RouteDescriptor<
  Config extends RouteInputConfig = RouteInputConfig,
> extends Descriptor<
    "http.route",
    {
      readonly name?: string;
      readonly summary?: string;
      readonly description?: string;
      readonly req?: Config;
    }
  > {}

/**
 * A route reference: the `http.route` IR node carrying its `req` and `accept`
 * methods. Pass the reference around; never reach into descriptor internals.
 *
 * @group DSL
 */
export interface HttpRouteBuilder<
  Config extends RouteInputConfig = RouteInputConfig,
> extends RouteDescriptor<Config> {
  readonly req: <Next extends RouteInputConfig>(
    config: Next,
  ) => HttpRouteBuilder<Next>;
  readonly accept: (
    method: HttpMethod,
    path: string,
  ) => HttpEndpointBuilder<Config>;
}

/**
 * An app reference: the `app` IR node carrying its `route` and `serve` methods.
 * Pass the reference around; never reach into descriptor internals.
 *
 * @group DSL
 */
export interface HttpAppBuilder extends AppDescriptor {
  readonly route: (config?: RouteConfig) => HttpRouteBuilder;
  readonly serve: () => HttpRouter;
}

/**
 * Creates an HTTP app junction. The returned reference is the app descriptor
 * with the DSL attached, so `route(app)` and `serve(app)` take it directly.
 * An app holds any number of routes (`app -has n-> route`), each unique within
 * the app.
 *
 * @group DSL
 * @example Define an app with routes
 */
export function app(name?: string): HttpAppBuilder {
  const descriptor = createApp(name);
  const builder = withMethods(descriptor, {
    route: (config?: RouteConfig) => route(builder, config),
    serve: () => serve(builder),
  });
  return builder;
}

/**
 * Attaches a route builder to an app. Routes are unique within their app and
 * may repeat across apps; give each route a `name` in the config to key it, or
 * omit it to auto-number it. The config (`name`, `summary`, `description`) is
 * stored on the route IR node for artifact generators to consume.
 *
 * @group DSL
 * @example Declare validated inputs
 */
export function route<Config extends RouteInputConfig = RouteInputConfig>(
  app: HttpAppBuilder | AppDescriptor,
  config?: RouteConfig,
): HttpRouteBuilder<Config> {
  const descriptor = app as AppDescriptor;
  const routeName =
    config?.name ?? String(childrenOf(descriptor, "http.route").length);
  const routeDescriptor = defineDescriptor(
    "http.route",
    `${descriptor.__key}:http.route:${routeName}`,
    {
      ...(config?.name === undefined ? {} : { name: config.name }),
      ...(config?.summary === undefined ? {} : { summary: config.summary }),
      ...(config?.description === undefined
        ? {}
        : { description: config.description }),
    },
  ) as RouteDescriptor<Config>;
  relate(descriptor, "http.route", routeDescriptor);

  const builder = withMethods(routeDescriptor, {
    req: <Next extends RouteInputConfig>(config: Next) => {
      refine(routeDescriptor, { req: config });
      return builder as unknown as HttpRouteBuilder<Next>;
    },
    accept: (method: HttpMethod, path: string) => {
      return accept(builder, method, path);
    },
  });

  return builder;
}

export { accept } from "./endpoint.js";
export type {
  EndpointDescriptor,
  HandlerDescriptor,
  HttpEndpointBuilder,
} from "./endpoint.js";

export { json, status } from "./response.js";
export { serve } from "./serve.js";
export type { HttpRouter } from "./serve.js";

export { serveNode } from "./node-server.js";
export type { NodeServerDocs, NodeServerOptions } from "./node-server.js";

export { routesOf } from "./routes.js";
export type { CollectedEndpoint, CollectedRoute } from "./routes.js";

export { cookies, headers, params, query } from "./extract.js";
export { chain, getExtractorMetadata } from "@smitejs/fp";
export type { Extractor, ExtractorMetadata } from "@smitejs/fp";

/**
 * The HTTP DSL surface: `app`, `route`, `json`, `status`.
 *
 * @group DSL
 * @example Define an app with routes
 */
export const http = {
  app,
  route,
  json,
  status,
  serveNode,
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
