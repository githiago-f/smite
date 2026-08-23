import type { AppDescriptor } from "@smitejs/core";
import { serve } from "@smitejs/http";
import type { HttpRequest, HttpResponse } from "@smitejs/http";

/**
 * The subset of an API Gateway v2 event consumed by {@link lambdaify}.
 *
 * @group AWS
 */
export interface ApiGatewayV2Event {
  readonly version?: string;
  readonly rawPath?: string;
  readonly path?: string;
  readonly rawQueryString?: string;
  readonly queryStringParameters?: Readonly<Record<string, string | undefined>>;
  readonly headers?: Readonly<Record<string, string | undefined>>;
  readonly cookies?: readonly string[];
  readonly body?: string | null;
  readonly isBase64Encoded?: boolean;
  readonly requestContext?: {
    readonly http?: {
      readonly method?: string;
      readonly path?: string;
    };
  };
}

/**
 * The API Gateway proxy response returned by {@link lambdaify}.
 *
 * @group AWS
 */
export interface ApiGatewayResponse {
  readonly statusCode: number;
  readonly headers: Readonly<Record<string, string>>;
  readonly cookies?: readonly string[];
  readonly body: string;
  readonly isBase64Encoded: false;
}

/**
 * The AWS Lambda handler produced by {@link lambdaify}.
 *
 * @group AWS
 */
export type ApiGatewayHandler = (
  event: ApiGatewayV2Event,
  context?: unknown,
) => Promise<ApiGatewayResponse>;

const parseCookies = (values: readonly string[] | undefined) => {
  const cookies: Record<string, string> = {};
  for (const value of values ?? []) {
    const separator = value.indexOf("=");
    if (separator === -1) continue;
    const key = value.slice(0, separator).trim();
    const cookieValue = value.slice(separator + 1).trim();
    if (key.length > 0) cookies[key] = cookieValue;
  }
  return cookies;
};

const queryFrom = (event: ApiGatewayV2Event) => {
  const query: Record<string, unknown> = {};
  if (event.rawQueryString !== undefined && event.rawQueryString.length > 0) {
    for (const [key, value] of new URLSearchParams(event.rawQueryString)) {
      query[key] = value;
    }
  }
  for (const [key, value] of Object.entries(
    event.queryStringParameters ?? {},
  )) {
    if (value !== undefined) query[key] = value;
  }
  return query;
};

const bodyFrom = (event: ApiGatewayV2Event): unknown => {
  if (event.body === undefined || event.body === null || event.body === "") {
    return undefined;
  }
  const raw =
    event.isBase64Encoded === true
      ? Buffer.from(event.body, "base64").toString("utf8")
      : event.body;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
};

const requestFrom = (event: ApiGatewayV2Event): HttpRequest => {
  const headers = event.headers ?? {};
  const cookies = event.cookies ?? [];
  return {
    method: event.requestContext?.http?.method ?? "GET",
    path:
      event.rawPath ?? event.requestContext?.http?.path ?? event.path ?? "/",
    query: queryFrom(event),
    headers: {
      ...headers,
      ...(cookies.length === 0 ? {} : { cookie: cookies.join("; ") }),
    },
    cookies: parseCookies(cookies),
    params: {},
    body: bodyFrom(event),
  };
};

const responseBody = (response: HttpResponse): string =>
  typeof response.body === "string"
    ? response.body
    : JSON.stringify(response.body ?? null);

const responseFrom = (response: HttpResponse): ApiGatewayResponse => ({
  statusCode: response.status,
  headers: {
    "content-type": "application/json; charset=utf-8",
    ...(response.headers ?? {}),
  },
  body: responseBody(response),
  isBase64Encoded: false,
});

/**
 * Options for {@link lambdaify}: scope the handler to a single named router.
 *
 * @group AWS
 */
export interface LambdaifyOptions {
  /** Serve only this named router; other routes return 404. */
  readonly router: string;
}

/**
 * Adapts a Smite app (or a single named router) to an AWS API Gateway v2 Lambda
 * handler. When `router` is given, the handler only dispatches that router's
 * routes, so each router becomes a genuinely separate Lambda. The returned
 * handler closes over the scoped app; requests for other routers return 404.
 *
 * @group AWS
 * @example Lambdaify an app
 */
export function lambdaify(
  app: AppDescriptor,
  options?: LambdaifyOptions,
): ApiGatewayHandler {
  const router = serve(
    app,
    options === undefined ? {} : { routers: [options.router] },
  );
  return async (event) => {
    try {
      return responseFrom(await router(requestFrom(event)));
    } catch {
      return responseFrom({
        status: 500,
        body: { error: "Internal Server Error" },
      });
    }
  };
}
