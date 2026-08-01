import type {
  HttpControllerDescriptor,
  HttpExecutionRequest,
  HttpExecutionResult,
  HttpRouteDescriptor,
  LifecycleSource,
  MessagingConsumerDescriptor,
  SchedulerJobDescriptor,
} from "../types.js";
import type { CronEvent } from "./event.js";
import { executeHttpPipeline, executePipeline } from "./execute.js";
import type { PipelineContext, PipelineTarget } from "./execute.js";
import type { HttpControllerBuilder } from "./http.js";
import type { MessagingConsumerBuilder } from "./messaging.js";
import type { SchedulerJobBuilder } from "./scheduler.js";

type MaybePromise<Value> = PromiseLike<Value> | Value;

type HandleifySource =
  | HttpControllerBuilder
  | HttpControllerDescriptor
  | MessagingConsumerBuilder
  | MessagingConsumerDescriptor
  | SchedulerJobBuilder
  | SchedulerJobDescriptor;

/**
 * Turns a messaging consumer descriptor into a plain function that runs its
 * lifecycle and dispatches its handler with the message as context input.
 *
 * @group Execution
 * @intent Gives transports a runtime function for a messaging consumer.
 * @example Handleify a messaging consumer
 */
export function handleify(
  descriptor: MessagingConsumerBuilder | MessagingConsumerDescriptor,
): (message: unknown) => Promise<unknown>;

/**
 * Turns a scheduled job descriptor into a plain function that runs its
 * lifecycle and dispatches its handler.
 *
 * The returned function accepts an optional cron event, which becomes the
 * handler's input.
 *
 * @group Execution
 * @intent Gives schedulers a runtime function for a job.
 * @example Handleify a scheduler job
 */
export function handleify(
  descriptor: SchedulerJobBuilder | SchedulerJobDescriptor,
): (event?: CronEvent) => Promise<unknown>;

/**
 * Turns an HTTP controller descriptor into a plain function that matches a
 * request to a route, runs the merged lifecycle, and dispatches the handler.
 *
 * @group Execution
 * @intent Gives HTTP adapters a runtime function for a controller.
 * @example Handleify a controller
 */
export function handleify(
  descriptor: HttpControllerBuilder | HttpControllerDescriptor,
): (request: HttpExecutionRequest) => Promise<HttpExecutionResult>;

/**
 * Turns any supported transport descriptor into a plain runtime function that
 * runs its middlewares and dispatches its handler.
 *
 * The returned function is transport-shaped: a controller takes an HTTP
 * request, a consumer takes a message, and a job takes an optional cron event.
 *
 * @group Execution
 * @intent Exposes the core runtime executor over semantic descriptors.
 * @example Handleify a scheduler job
 * @example Handleify a messaging consumer
 * @example Handleify a controller
 */
export function handleify(descriptor: HandleifySource): unknown {
  const normalized = unwrapDescriptor(descriptor);

  switch (normalized.kind) {
    case "messaging.consumer":
      return handleMessaging(normalized);
    case "scheduler.job":
      return handleScheduler(normalized);
    case "http.controller":
      return handleController(normalized);
    default:
      throw new Error(
        `handleify: unsupported descriptor kind "${(normalized as { readonly kind: string }).kind}".`,
      );
  }
}

const handleMessaging = (
  descriptor: MessagingConsumerDescriptor,
): ((message: unknown) => Promise<unknown>) => {
  const target = createPipelineTarget(descriptor.lifecycle, (context) =>
    descriptor.handler ? descriptor.handler(context) : undefined,
  );

  return async (message) => {
    const outcome = await executePipeline(target, {
      input: message,
      state: {},
    });

    return outcome.kind === "value" ? outcome.value : undefined;
  };
};

const handleScheduler = (
  descriptor: SchedulerJobDescriptor,
): ((event?: CronEvent) => Promise<unknown>) => {
  const target = createPipelineTarget(descriptor.lifecycle, (context) =>
    descriptor.handler ? descriptor.handler(context) : undefined,
  );

  return async (event) => {
    const outcome = await executePipeline(target, {
      input: event,
      state: {},
    });

    return outcome.kind === "value" ? outcome.value : undefined;
  };
};

const handleController = (
  descriptor: HttpControllerDescriptor,
): ((request: HttpExecutionRequest) => Promise<HttpExecutionResult>) => {
  const routes = descriptor.routes.map((route) =>
    compileRoute(descriptor.path, route),
  );

  return async (request) => {
    const matched = matchCompiledRoute(routes, request);
    if (!matched) {
      return { status: 404, body: { error: "Not found" } };
    }

    return executeHttpPipeline(descriptor, matched.route, {
      request: { ...request, params: matched.params },
      state: {},
    });
  };
};

const createPipelineTarget = <Input, Value>(
  lifecycle: LifecycleSource,
  dispatch: (context: PipelineContext<Input>) => MaybePromise<Value>,
): PipelineTarget<PipelineContext<Input>, Value> => ({
  lifecycle,
  readInput: (context) => context.input,
  withInput: (context, input) => ({
    ...context,
    input: input as Input,
  }),
  dispatch,
});

interface CompiledRoute {
  readonly method: string;
  readonly pattern: RegExp;
  readonly params: readonly string[];
  readonly route: HttpRouteDescriptor;
}

const compileRoute = (
  controllerPath: string,
  route: HttpRouteDescriptor,
): CompiledRoute => {
  const params: string[] = [];
  const segments = normalizePath(`${controllerPath}${route.path}`)
    .split("/")
    .filter((segment) => segment.length > 0);

  const source = segments
    .map((segment) => {
      if (segment.startsWith(":")) {
        params.push(segment.slice(1));
        return "([^/]+)";
      }

      return segment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    })
    .join("/");

  return {
    method: route.method,
    pattern: new RegExp(`^/${source}$`, "i"),
    params,
    route,
  };
};

const matchCompiledRoute = (
  routes: readonly CompiledRoute[],
  request: HttpExecutionRequest,
):
  | {
      readonly route: HttpRouteDescriptor;
      readonly params: Readonly<Record<string, string>>;
    }
  | undefined => {
  const method = request.method.toUpperCase();
  const path = normalizePath(request.path);

  for (const compiled of routes) {
    if (compiled.method !== method) {
      continue;
    }

    const match = compiled.pattern.exec(path);
    if (!match) {
      continue;
    }

    const params: Record<string, string> = {};
    compiled.params.forEach((name, index) => {
      const value = match[index + 1];
      if (value !== undefined) {
        params[name] = value;
      }
    });

    return { route: compiled.route, params };
  }

  return undefined;
};

const unwrapDescriptor = (
  source: HandleifySource,
):
  | HttpControllerDescriptor
  | MessagingConsumerDescriptor
  | SchedulerJobDescriptor =>
  "descriptor" in source ? source.descriptor : source;

const normalizePath = (path: string): string => {
  if (path === "") {
    return "/";
  }

  if (path.length > 1 && path.endsWith("/")) {
    return path.slice(0, -1);
  }

  return path;
};
