import { childrenOf, defineDescriptor, relate } from "@smitejs/core";
import type { AppDescriptor, Descriptor } from "@smitejs/core";
import { accept } from "./endpoint.js";
import type { EndpointPlan, HttpEndpointBuilder } from "./endpoint.js";
import type {
  HttpHandler,
  HttpMethod,
  MergeRequestConfig,
  RouteConfig,
  RouteInputConfig,
} from "./types.js";
import { withMethods } from "./withMethods.js";

declare const ALLOW_GLOBAL_REGISTRY: boolean;

const DOMAIN_HANDLER = Symbol.for("@smitejs/domain/handler");

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

/** A handler node wrapping a runtime function, related to its endpoint. */
export interface HandlerDescriptor
  extends Descriptor<"http.handler", { readonly fn: HttpHandler }> {}

/** A route node in the IR, holding its descriptive `config` and `req`. @group DSL */
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

/** Type-level tag carried by every {@link HttpRouteBuilder}. */
export const routeBuilderSymbol: unique symbol = Symbol("http.routeBuilder");

/**
 * The type-level shape of any route builder, regardless of its inferred input
 * config. `app.use` accepts this plus {@link HttpAspect} so routes can be
 * declared standalone and injected later.
 *
 * @group DSL
 */
export interface HttpRouterBuilder {
  readonly [routeBuilderSymbol]: typeof routeBuilderSymbol;
}

/**
 * A router reference: a standalone builder that declares endpoints and is
 * injected into an app with `app.use(...)`. Until then it is a plain plan — no
 * IR is written. Routes created by the same builder share a router-level
 * `input` that each endpoint inherits per bucket.
 *
 * @group DSL
 * @example Declare routes with methods
 */
export interface HttpRouteBuilder<
  Config extends RouteInputConfig = RouteInputConfig,
> extends HttpRouterBuilder {
  readonly input: <Next extends RouteInputConfig>(
    config: Next,
  ) => HttpRouteBuilder<Next>;
  readonly accept: (
    method: HttpMethod,
    path: string,
  ) => HttpEndpointBuilder<Config>;
  readonly get: <Next extends RouteInputConfig>(
    path: string,
    input: Next,
    handler: HttpHandler<MergeRequestConfig<Config, Next>>,
  ) => HttpRouteBuilder<Config>;
  readonly post: <Next extends RouteInputConfig>(
    path: string,
    input: Next,
    handler: HttpHandler<MergeRequestConfig<Config, Next>>,
  ) => HttpRouteBuilder<Config>;
  readonly put: <Next extends RouteInputConfig>(
    path: string,
    input: Next,
    handler: HttpHandler<MergeRequestConfig<Config, Next>>,
  ) => HttpRouteBuilder<Config>;
  readonly patch: <Next extends RouteInputConfig>(
    path: string,
    input: Next,
    handler: HttpHandler<MergeRequestConfig<Config, Next>>,
  ) => HttpRouteBuilder<Config>;
  readonly delete: <Next extends RouteInputConfig>(
    path: string,
    input: Next,
    handler: HttpHandler<MergeRequestConfig<Config, Next>>,
  ) => HttpRouteBuilder<Config>;
  readonly head: <Next extends RouteInputConfig>(
    path: string,
    input: Next,
    handler: HttpHandler<MergeRequestConfig<Config, Next>>,
  ) => HttpRouteBuilder<Config>;
  readonly options: <Next extends RouteInputConfig>(
    path: string,
    input: Next,
    handler: HttpHandler<MergeRequestConfig<Config, Next>>,
  ) => HttpRouteBuilder<Config>;
  readonly any: <Next extends RouteInputConfig>(
    path: string,
    input: Next,
    handler: HttpHandler<MergeRequestConfig<Config, Next>>,
  ) => HttpRouteBuilder<Config>;
}

type RoutePlanState = {
  readonly config?: RouteConfig;
  req?: RouteInputConfig;
  readonly endpoints: EndpointPlan[];
};

/**
 * Creates a router builder that is not yet attached to an app. Declare
 * endpoints on it (with `accept`, method shortcuts, or via {@link methods})
 * and inject it with `app.use(builder)`. Pass `config` (`name`, `summary`,
 * `description`) for artifact generators.
 *
 * @group DSL
 * @example Declare validated inputs
 */
export function router<Config extends RouteInputConfig = RouteInputConfig>(
  config?: RouteConfig,
): HttpRouteBuilder<Config> {
  const plan = {
    [routeBuilderSymbol]: routeBuilderSymbol,
    ...(config === undefined ? {} : { config }),
    endpoints: [],
  } as RoutePlanState & HttpRouterBuilder;

  const builder = withMethods(plan, {
    input: <Next extends RouteInputConfig>(next: Next) => {
      plan.req = next;
      return builder as unknown as HttpRouteBuilder<Next>;
    },
    accept: (method: HttpMethod, path: string) =>
      accept(plan, builder, method, path),
    get: <Next extends RouteInputConfig>(
      path: string,
      input: Next,
      handler: HttpHandler<MergeRequestConfig<Config, Next>>,
    ) => {
      accept(plan, builder, "GET", path).input(input).handler(handler);
      return builder;
    },
    post: <Next extends RouteInputConfig>(
      path: string,
      input: Next,
      handler: HttpHandler<MergeRequestConfig<Config, Next>>,
    ) => {
      accept(plan, builder, "POST", path).input(input).handler(handler);
      return builder;
    },
    put: <Next extends RouteInputConfig>(
      path: string,
      input: Next,
      handler: HttpHandler<MergeRequestConfig<Config, Next>>,
    ) => {
      accept(plan, builder, "PUT", path).input(input).handler(handler);
      return builder;
    },
    patch: <Next extends RouteInputConfig>(
      path: string,
      input: Next,
      handler: HttpHandler<MergeRequestConfig<Config, Next>>,
    ) => {
      accept(plan, builder, "PATCH", path).input(input).handler(handler);
      return builder;
    },
    delete: <Next extends RouteInputConfig>(
      path: string,
      input: Next,
      handler: HttpHandler<MergeRequestConfig<Config, Next>>,
    ) => {
      accept(plan, builder, "DELETE", path).input(input).handler(handler);
      return builder;
    },
    head: <Next extends RouteInputConfig>(
      path: string,
      input: Next,
      handler: HttpHandler<MergeRequestConfig<Config, Next>>,
    ) => {
      accept(plan, builder, "HEAD", path).input(input).handler(handler);
      return builder;
    },
    options: <Next extends RouteInputConfig>(
      path: string,
      input: Next,
      handler: HttpHandler<MergeRequestConfig<Config, Next>>,
    ) => {
      accept(plan, builder, "OPTIONS", path).input(input).handler(handler);
      return builder;
    },
    any: <Next extends RouteInputConfig>(
      path: string,
      input: Next,
      handler: HttpHandler<MergeRequestConfig<Config, Next>>,
    ) => {
      accept(plan, builder, "ANY", path).input(input).handler(handler);
      return builder;
    },
  }) as HttpRouteBuilder<Config>;

  return builder;
}

/**
 * A standalone, single-endpoint router builder per HTTP method. `methods.get`
 * is sugar for `router().accept("GET", path).input(config).handler(fn)`;
 * inject the result with `app.use(...)`.
 *
 * @group DSL
 * @example Declare routes with methods
 */
export const methods = {
  get: <Next extends RouteInputConfig>(
    path: string,
    input: Next,
    handler: HttpHandler<MergeRequestConfig<RouteInputConfig, Next>>,
  ): HttpRouteBuilder<RouteInputConfig> => {
    const route = router();
    return route.accept("GET", path).input(input).handler(handler);
  },
  post: <Next extends RouteInputConfig>(
    path: string,
    input: Next,
    handler: HttpHandler<MergeRequestConfig<RouteInputConfig, Next>>,
  ): HttpRouteBuilder<RouteInputConfig> => {
    const route = router();
    return route.accept("POST", path).input(input).handler(handler);
  },
  put: <Next extends RouteInputConfig>(
    path: string,
    input: Next,
    handler: HttpHandler<MergeRequestConfig<RouteInputConfig, Next>>,
  ): HttpRouteBuilder<RouteInputConfig> => {
    const route = router();
    return route.accept("PUT", path).input(input).handler(handler);
  },
  patch: <Next extends RouteInputConfig>(
    path: string,
    input: Next,
    handler: HttpHandler<MergeRequestConfig<RouteInputConfig, Next>>,
  ): HttpRouteBuilder<RouteInputConfig> => {
    const route = router();
    return route.accept("PATCH", path).input(input).handler(handler);
  },
  delete: <Next extends RouteInputConfig>(
    path: string,
    input: Next,
    handler: HttpHandler<MergeRequestConfig<RouteInputConfig, Next>>,
  ): HttpRouteBuilder<RouteInputConfig> => {
    const route = router();
    return route.accept("DELETE", path).input(input).handler(handler);
  },
  head: <Next extends RouteInputConfig>(
    path: string,
    input: Next,
    handler: HttpHandler<MergeRequestConfig<RouteInputConfig, Next>>,
  ): HttpRouteBuilder<RouteInputConfig> => {
    const route = router();
    return route.accept("HEAD", path).input(input).handler(handler);
  },
  options: <Next extends RouteInputConfig>(
    path: string,
    input: Next,
    handler: HttpHandler<MergeRequestConfig<RouteInputConfig, Next>>,
  ): HttpRouteBuilder<RouteInputConfig> => {
    const route = router();
    return route.accept("OPTIONS", path).input(input).handler(handler);
  },
  any: <Next extends RouteInputConfig>(
    path: string,
    input: Next,
    handler: HttpHandler<MergeRequestConfig<RouteInputConfig, Next>>,
  ): HttpRouteBuilder<RouteInputConfig> => {
    const route = router();
    return route.accept("ANY", path).input(input).handler(handler);
  },
};

/**
 * Materializes an injected router builder into an app's IR: creates the
 * `http.route` node (keyed within the app, auto-numbered when unnamed), its
 * `http.endpoint` children, and each endpoint's `http.handler`. Called by
 * `app.use(...)`.
 *
 * @group DSL
 */
export function materializeRoute<Config extends RouteInputConfig>(
  app: AppDescriptor,
  builder: HttpRouterBuilder,
): RouteDescriptor<Config> {
  const plan = builder as unknown as RoutePlanState;
  const config = plan.config;
  if (config?.name !== undefined && !/^[A-Za-z]+$/.test(config.name)) {
    throw new Error(
      `Route name '${config.name}' must contain only letters and no spaces.`,
    );
  }
  const routeName =
    config?.name ?? String(childrenOf(app, "http.route").length);
  const routeDescriptor = defineDescriptor(
    "http.route",
    `${app.__key}:http.route:${routeName}`,
    {
      ...(config?.name === undefined ? {} : { name: config.name }),
      ...(config?.summary === undefined ? {} : { summary: config.summary }),
      ...(config?.description === undefined
        ? {}
        : { description: config.description }),
      ...(plan.req === undefined ? {} : { req: plan.req }),
    },
  ) as RouteDescriptor<Config>;
  relate(app, "http.route", routeDescriptor);

  for (const endpoint of plan.endpoints) {
    const endpointDescriptor = defineDescriptor(
      "http.endpoint",
      `${routeDescriptor.__key}:endpoint:${endpoint.method} ${endpoint.path}`,
      {
        method: endpoint.method,
        path: endpoint.path,
        ...(endpoint.req === undefined ? {} : { req: endpoint.req }),
      },
    ) as Descriptor<
      "http.endpoint",
      { method: HttpMethod; path: string; req?: RouteInputConfig }
    >;
    relate(routeDescriptor, "http.endpoint", endpointDescriptor);

    if (endpoint.handler !== undefined) {
      const handler = defineDescriptor(
        "http.handler",
        `http.handler:${endpointDescriptor.__key}`,
        { fn: endpoint.handler },
      ) as HandlerDescriptor;
      relate(endpointDescriptor, "http.handler", handler);
      relateDomainUsecase(handler, endpoint.handler);
    }
  }

  return routeDescriptor;
}
