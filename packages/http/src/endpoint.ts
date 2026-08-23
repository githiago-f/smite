import type { HttpRouteBuilder } from "./router.js";
import type {
  HttpHandler,
  HttpMethod,
  MergeRequestConfig,
  RouteInputConfig,
} from "./types.js";

/**
 * A deferred endpoint declaration on a router plan: its method + path pair,
 * an optional per-endpoint `req` override, and its handler. Materialized into
 * an `http.endpoint` node (plus an `http.handler` child) when the router is
 * injected into an app.
 *
 * @group DSL
 */
export interface EndpointPlan {
  readonly method: HttpMethod;
  readonly path: string;
  req?: RouteInputConfig;
  handler?: HttpHandler;
}

/**
 * An endpoint reference: the plan carrying its `input` (the explicit
 * inheritance of {@link MergeRequestConfig}) and `handler` methods. `handler`
 * wires the function and returns the owning router, so declarations chain.
 *
 * @group DSL
 */
export interface HttpEndpointBuilder<
  Base extends RouteInputConfig = RouteInputConfig,
  Config extends RouteInputConfig = MergeRequestConfig<Base, Base>,
> {
  readonly input: <Next extends RouteInputConfig>(
    config: Next,
  ) => HttpEndpointBuilder<Base, MergeRequestConfig<Base, Next>>;
  readonly handler: (fn: HttpHandler<Config>) => HttpRouteBuilder<Base>;
}

/**
 * Declares an endpoint (method + path) on a router plan and returns a builder
 * for its optional per-endpoint `input` and its handler. `input` resolves per
 * bucket against the router's `input` (endpoint wins, router inherits).
 *
 * @group DSL
 * @example Add endpoints and handlers
 */
export function accept<Base extends RouteInputConfig>(
  plan: { readonly endpoints: EndpointPlan[] },
  route: HttpRouteBuilder<Base>,
  method: HttpMethod,
  path: string,
): HttpEndpointBuilder<Base> {
  const endpoint: EndpointPlan = { method, path };
  (plan.endpoints as EndpointPlan[]).push(endpoint);

  const builder = {
    input: <Next extends RouteInputConfig>(config: Next) => {
      endpoint.req = config;
      return builder as unknown as HttpEndpointBuilder<
        Base,
        MergeRequestConfig<Base, Next>
      >;
    },
    handler: (fn: HttpHandler<MergeRequestConfig<Base, Base>>) => {
      endpoint.handler = fn;
      return route;
    },
  };

  return builder;
}
