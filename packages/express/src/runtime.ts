import { executeHttpPipeline } from "@smite/core";
import { Result } from "@smite/fp";
import type {
  ExpressNextFunction,
  ExpressRequestLike,
  ExpressResponseLike,
  ExpressRouteDescriptor,
  ExpressRuntimeOptions,
} from "./types.js";
import type { HttpControllerDescriptor } from "@smite/core";

const routeMethods = {
  GET: "get",
  POST: "post",
  PUT: "put",
  PATCH: "patch",
  DELETE: "delete",
  HEAD: "head",
  OPTIONS: "options",
} as const;

export const createExpressRuntime = (
  options: ExpressRuntimeOptions,
): ((
  request: ExpressRequestLike,
  response: ExpressResponseLike,
  next: ExpressNextFunction,
) => Promise<void>) => {
  const controllers = options.application.descriptor.controllers;

  for (const controller of options.controllers.map(unwrapController)) {
    const controllerRouter = Router();

      if (!match) {
        sendExpressResult(response, {
          status: 404,
          body: { error: "Not found" },
        });
        return;
      }

      const wrappedRoute = {
        ...match.route,
        handler: wrapHandler(match.route.handler),
      };

      const result = await executeHttpPipeline(
        match.controller,
        wrappedRoute,
        createHttpExecutionContext(request),
      );
    }

    router.use(controller.path, controllerRouter);
  }

  return router;
};

const createRouteMiddleware =
  (
    controller: ExpressControllerDescriptor,
    route: ExpressRouteDescriptor,
  ): RequestHandler =>
  async (request, response, next) => {
    try {
      const result = await executeHttpPipeline(
        controller,
        route,
        createHttpExecutionContext(request as unknown as ExpressRequestLike),
      );
      sendExpressResult(response as unknown as ExpressResponseLike, result);
    } catch (error) {
      next(error);
    }
  };

const wrapHandler = (
  handler: ExpressRouteDescriptor["handler"],
): ExpressRouteDescriptor["handler"] =>
  async (context: unknown) => {
    const raw = await (handler as (context: unknown) => unknown)(context);

    if (raw instanceof Result) {
      return raw.match(
        (value: unknown) => ({ body: value }),
        (error: unknown) => {
          if (
            error !== null &&
            typeof error === "object" &&
            "tag" in error &&
            typeof (error as Record<string, unknown>).tag === "number"
          ) {
            return {
              status: (error as { readonly tag: number }).tag,
              body: (error as unknown as { readonly data: unknown }).data,
            };
          }

          return { status: 500, body: { error: "Internal Server Error" } };
        },
      );
    }

    return raw;
  };

const findRoute = (
  controllers: readonly HttpControllerDescriptor[],
  request: ExpressRequestLike,
):
  | {
      readonly controller: HttpControllerDescriptor;
      readonly route: ExpressRouteDescriptor;
    }
  | undefined => {
  const method = request.method?.toUpperCase() ?? "GET";
  const path = getRequestPath(request);

  for (const controller of controllers) {
    for (const route of controller.routes) {
      const routePath = normalizePath(`${controller.path}${route.path}`);
      if (route.method === method && routePath === path) {
        return { controller, route };
      }
    }
  }

  return undefined;
};

const createHttpExecutionContext = (
  request: ExpressRequestLike,
): Parameters<typeof executeHttpPipeline>[2] => {
  const url = new URL(
    request.originalUrl ?? request.url ?? "/",
    "http://smite.local",
  );

  return {
    request: {
      method: request.method?.toUpperCase() ?? "GET",
      path: normalizePath(request.path ?? url.pathname),
      headers: request.headers ?? {},
      cookies:
        request.cookies ?? parseCookies(readCookieHeader(request.headers)),
      query: request.query ?? Object.fromEntries(url.searchParams.entries()),
      params: request.params ?? {},
      body: request.body,
      raw: request,
    },
    state: {},
  };
};

const readCookieHeader = (
  headers: ExpressRequestLike["headers"],
): string | undefined => {
  if (!headers) {
    return undefined;
  }

  for (const [name, value] of Object.entries(headers)) {
    if (name.toLowerCase() !== "cookie") {
      continue;
    }

    if (typeof value === "string") {
      return value;
    }

    return Array.isArray(value) ? value[0] : undefined;
  }

  return undefined;
};

const parseCookies = (header: string | undefined): Record<string, string> => {
  const cookies: Record<string, string> = {};

  if (!header) {
    return cookies;
  }

  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator === -1) {
      continue;
    }

    const name = part.slice(0, separator).trim();
    if (name.length === 0) {
      continue;
    }

    cookies[name] = decodeCookieValue(part.slice(separator + 1).trim());
  }

  return cookies;
};

const decodeCookieValue = (value: string): string => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const sendExpressResult = (
  response: ExpressResponseLike,
  result: Awaited<ReturnType<typeof executeHttpPipeline>>,
): void => {
  if (response.headersSent) {
    return;
  }

  for (const [name, value] of Object.entries(result.headers ?? {})) {
    response.setHeader?.(name, value);
  }

  const status = result.status ?? (result.body === undefined ? 204 : 200);

  if (response.status) {
    response.status(status);
  } else {
    response.statusCode = status;
  }

  if (result.body === undefined) {
    response.end?.();
    return;
  }

  if (response.json) {
    response.json(result.body);
    return;
  }

  response.setHeader?.("content-type", "application/json");
  response.end?.(JSON.stringify(result.body));
};

const normalizePath = (path: string): string => {
  if (path === "") {
    return "/";
  }

  if (path.length > 1 && path.endsWith("/")) {
    return path.slice(0, -1);
  }

  return path;
};
