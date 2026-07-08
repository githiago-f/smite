import { executeHttpPipeline } from "@smitejs/core";
import type {
  ExpressControllerDescriptor,
  ExpressNextFunction,
  ExpressRequestLike,
  ExpressResponseLike,
  ExpressRouteDescriptor,
  ExpressRuntimeOptions,
} from "./types.js";

export const createExpressRuntime = (
  options: ExpressRuntimeOptions,
): ((
  request: ExpressRequestLike,
  response: ExpressResponseLike,
  next: ExpressNextFunction,
) => Promise<void>) => {
  const controllers = options.controllers.map(unwrapController);

  return async (request, response, next) => {
    try {
      const match = findRoute(controllers, request);

      if (!match) {
        sendExpressResult(response, {
          status: 404,
          body: { error: "Not found" },
        });
        return;
      }

      const result = await executeHttpPipeline(
        match.controller,
        match.route,
        createHttpExecutionContext(request),
      );
      sendExpressResult(response, result);
    } catch (error) {
      next(error);
    }
  };
};

const unwrapController = (
  source: ExpressRuntimeOptions["controllers"][number],
): ExpressControllerDescriptor => {
  if ("descriptor" in source) {
    return source.descriptor;
  }

  return source;
};

const findRoute = (
  controllers: readonly ExpressControllerDescriptor[],
  request: ExpressRequestLike,
):
  | {
      readonly controller: ExpressControllerDescriptor;
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
      query: request.query ?? Object.fromEntries(url.searchParams.entries()),
      params: request.params ?? {},
      body: request.body,
      raw: request,
    },
    state: {},
  };
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

const getRequestPath = (request: ExpressRequestLike): string => {
  const path = request.path;
  if (path) {
    return normalizePath(path);
  }

  const url = new URL(
    request.originalUrl ?? request.url ?? "/",
    "http://smite.local",
  );
  return normalizePath(url.pathname);
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
