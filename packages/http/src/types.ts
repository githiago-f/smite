import type { z } from "zod";

/**
 * The HTTP methods supported by the DSL.
 *
 * @group Types
 */
export const HttpMethod = {
  ANY: "ANY",
  GET: "GET",
  POST: "POST",
  PUT: "PUT",
  DELETE: "DELETE",
  OPTIONS: "OPTIONS",
  HEAD: "HEAD",
  PATCH: "PATCH",
} as const;
export type HttpMethod = (typeof HttpMethod)[keyof typeof HttpMethod];

/**
 * A subset of HTTP status codes used by the response helpers.
 *
 * @group Types
 */
export const HttpStatus = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  NOT_FOUND: 404,
  INTERNAL_SERVER_ERROR: 500,
} as const;
export type HttpStatus = (typeof HttpStatus)[keyof typeof HttpStatus];

export interface RouteInputConfig {
  readonly query?: z.ZodType;
  readonly params?: z.ZodType;
  readonly headers?: z.ZodType;
  readonly body?: z.ZodType;
}

/**
 * Declarative configuration attached to a route and stored on its IR node.
 * Purely descriptive; consumed by artifact generators such as the OpenAPI
 * plugin.
 *
 * @group Types
 */
export interface RouteConfig {
  /** Route name; also used as the route's IR key when unique within its app. */
  readonly name?: string;
  /** Short description shown as each endpoint's OpenAPI `summary`. */
  readonly summary?: string;
  /** Long description shown as each endpoint's OpenAPI `description`. */
  readonly description?: string;
}

export type InferBucket<
  Config,
  Key extends keyof RouteInputConfig,
> = Config extends Record<Key, infer Schema extends z.ZodType>
  ? z.infer<Schema>
  : never;

export interface HttpRequest {
  readonly method: string;
  readonly path: string;
  readonly query: Readonly<Record<string, unknown>>;
  readonly headers: Readonly<
    Record<string, string | readonly string[] | undefined>
  >;
  readonly cookies: Readonly<Record<string, string>>;
  readonly params: Readonly<Record<string, string>>;
  readonly body: unknown;
}

export interface HttpResponse {
  readonly status: number;
  readonly headers?: Readonly<Record<string, string>>;
  readonly body?: unknown;
}

export type HttpHandler<Config extends RouteInputConfig = RouteInputConfig> = (
  ctx: HttpHandlerContext<Config>,
) => unknown | Promise<unknown>;

export type HttpHandlerContext<Config extends RouteInputConfig> = {
  readonly request: HttpRequest;
} & {
  readonly query: [Config["query"]] extends [z.ZodType]
    ? z.infer<Config["query"]>
    : Readonly<Record<string, unknown>>;
  readonly params: [Config["params"]] extends [z.ZodType]
    ? z.infer<Config["params"]>
    : Readonly<Record<string, string>>;
  readonly headers: [Config["headers"]] extends [z.ZodType]
    ? z.infer<Config["headers"]>
    : Readonly<Record<string, string | readonly string[] | undefined>>;
  readonly body: [Config["body"]] extends [z.ZodType]
    ? z.infer<Config["body"]>
    : unknown;
};
