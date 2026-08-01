import { mergeLifecycleDescriptors } from "../lifecycle/merge.js";
import type {
  HttpControllerDescriptor,
  HttpExecutionContext,
  HttpExecutionResult,
  HttpHandlerResult,
  HttpRouteDescriptor,
  HttpRuntimeFunction,
  LifecycleSource,
} from "../types.js";

type MaybePromise<Value> = PromiseLike<Value> | Value;

/**
 * Any context carrying a state record, so providers can seed values.
 *
 * @group Execution
 */
export interface StatefulContext {
  readonly state: Readonly<Record<string, unknown>>;
}

/**
 * Generic execution context: the current input (body, message, payload) and
 * provider state.
 *
 * @group Execution
 */
export interface PipelineContext<Input = unknown> extends StatefulContext {
  readonly input: Input;
}

/**
 * Outcome of executing a pipeline.
 *
 * `value` carries the dispatch result; `denied` means a guard rejected the
 * request before the handler ran.
 *
 * @group Execution
 */
export type PipelineResult<Value> =
  | Readonly<{ readonly kind: "value"; readonly value: Value }>
  | Readonly<{ readonly kind: "denied" }>;

/**
 * Transport-agnostic execution target consumed by the core pipeline.
 *
 * The target owns how to read and transform the current input and how to
 * dispatch the handler, so the pipeline itself stays transport-independent.
 *
 * @group Execution
 */
export interface PipelineTarget<Context extends StatefulContext, Value> {
  readonly lifecycle: LifecycleSource;
  readonly readInput: (context: Context) => unknown;
  readonly withInput: (context: Context, input: unknown) => Context;
  readonly dispatch: (context: Context) => MaybePromise<Value>;
}

/**
 * Runs a lifecycle pipeline in core order over any stateful context.
 *
 * Providers seed state, guards may deny execution, pipes transform the
 * current input, interceptors run for side effects, and filters handle
 * failures. Dispatch is delegated to the target.
 *
 * @group Execution
 * @example Execute a pipeline
 */
export const executePipeline = async <Context extends StatefulContext, Value>(
  target: PipelineTarget<Context, Value>,
  initialContext: Context,
): Promise<PipelineResult<Value>> => {
  const lifecycle = mergeLifecycleDescriptors(target.lifecycle);
  let context = initialContext;

  try {
    for (const entry of lifecycle.entries) {
      const implementation = entry.implementation as
        | HttpRuntimeFunction
        | undefined;

      if (!implementation) {
        continue;
      }

      if (entry.entryKind === "provider") {
        const value = await implementation(context);
        context = withState(context, entry.name, value);
        continue;
      }

      if (entry.entryKind === "guard") {
        const allowed = await implementation(context);
        if (allowed === false) {
          return { kind: "denied" };
        }
        continue;
      }

      if (entry.entryKind === "pipe") {
        const input = await implementation(target.readInput(context), context);
        context = target.withInput(context, input);
        continue;
      }

      if (entry.entryKind === "interceptor") {
        await implementation(context);
      }
    }

    return { kind: "value", value: await target.dispatch(context) };
  } catch (error) {
    for (const entry of lifecycle.entries) {
      if (entry.entryKind !== "filter" || !entry.implementation) {
        continue;
      }

      const handled = await (entry.implementation as HttpRuntimeFunction)(
        error,
        context,
      );

      if (handled !== undefined) {
        return { kind: "value", value: handled as Value };
      }
    }

    throw error;
  }
};

/**
 * Executes a matched HTTP route through the core pipeline.
 *
 * Merges the controller and route lifecycle, then dispatches the route
 * handler. A denied guard becomes a 403 result.
 *
 * @group HTTP
 * @intent Executes one matched controller route with its merged lifecycle policy.
 */
export const executeHttpPipeline = async (
  controller: HttpControllerDescriptor,
  route: HttpRouteDescriptor,
  initialContext: HttpExecutionContext,
): Promise<HttpExecutionResult> => {
  const outcome = await executePipeline<HttpExecutionContext, unknown>(
    {
      lifecycle: mergeLifecycleDescriptors(
        controller.lifecycle,
        route.lifecycle,
      ),
      readInput: (context) => context.request.body,
      withInput: (context, body) => ({
        ...context,
        request: {
          ...context.request,
          body,
        },
      }),
      dispatch: (context) => (route.handler as HttpRuntimeFunction)(context),
    },
    initialContext,
  );

  if (outcome.kind === "denied") {
    return { status: 403, body: { error: "Forbidden" } };
  }

  return normalizeHttpExecutionResult(outcome.value);
};

const normalizeHttpExecutionResult = (
  result: HttpHandlerResult,
): HttpExecutionResult => {
  if (isHttpExecutionResult(result)) {
    return result;
  }

  return { body: result };
};

const isHttpExecutionResult = (
  result: unknown,
): result is HttpExecutionResult => {
  if (typeof result !== "object" || result === null) {
    return false;
  }

  return "status" in result || "headers" in result || "body" in result;
};

const withState = <Context extends StatefulContext>(
  context: Context,
  key: string,
  value: unknown,
): Context =>
  ({
    ...context,
    state: {
      ...context.state,
      [key]: value,
    },
  }) as Context;
