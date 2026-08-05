import { childrenOf } from "@smitejs/core";
import type { AppDescriptor, Descriptor } from "@smitejs/core";
import type { HttpMethod, RouteInputConfig } from "./types.js";

/**
 * An endpoint as seen by artifact generators: method, path template, and the
 * params extracted from the template.
 *
 * @group Routes
 */
export interface CollectedEndpoint {
  readonly method: HttpMethod;
  readonly path: string;
  readonly pathParams: readonly string[];
}

/**
 * A route as seen by artifact generators: its descriptive config (`name`,
 * `summary`, `description`), optional `req` schemas, plus the endpoints
 * declared on it.
 *
 * @group Routes
 */
export interface CollectedRoute {
  readonly name?: string;
  readonly summary?: string;
  readonly description?: string;
  readonly req?: RouteInputConfig;
  readonly endpoints: readonly CollectedEndpoint[];
}

type RouteNode = Descriptor<
  "http.route",
  {
    name?: string;
    summary?: string;
    description?: string;
    req?: RouteInputConfig;
  }
>;
type EndpointNode = Descriptor<
  "http.endpoint",
  { method: HttpMethod; path: string }
>;

const PATH_PARAM = /:([A-Za-z0-9_]+)/g;

const extractPathParams = (path: string): string[] => {
  const params: string[] = [];
  for (const match of path.matchAll(PATH_PARAM)) {
    params.push(match[1] ?? "");
  }
  return params;
};

/**
 * Walks an app's `http.route` and `http.endpoint` children and returns the
 * collected routes with their endpoints and path params. Shared by the client
 * and OpenAPI artifact generators.
 *
 * @group Routes
 * @example Collect an app's routes
 */
export function routesOf(app: AppDescriptor): readonly CollectedRoute[] {
  return childrenOf(app, "http.route").map((route) => {
    const { name, summary, description, req } = (route as RouteNode).data;
    return {
      ...(name === undefined ? {} : { name }),
      ...(summary === undefined ? {} : { summary }),
      ...(description === undefined ? {} : { description }),
      ...(req === undefined ? {} : { req }),
      endpoints: childrenOf(route, "http.endpoint").map((endpoint) => {
        const endpointNode = endpoint as EndpointNode;
        return {
          method: endpointNode.data.method,
          path: endpointNode.data.path,
          pathParams: extractPathParams(endpointNode.data.path),
        };
      }),
    };
  });
}
