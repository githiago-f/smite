import { mergeLifecycleDescriptors } from "../lifecycle/merge.js";
import type {
  HttpControllerDescriptor,
  HttpExecutionContext,
  HttpExecutionResult,
  HttpHandlerResult,
  HttpRouteDescriptor,
  HttpRuntimeFunction,
} from "../types.js";

export const executeHttpPipeline = async (
  controller: HttpControllerDescriptor,
  route: HttpRouteDescriptor,
  initialContext: HttpExecutionContext,
): Promise<HttpExecutionResult> => {
  let context = initialContext;
  const lifecycle = mergeLifecycleDescriptors(
    controller.lifecycle,
    route.lifecycle,
  );

  try {
    for (const entry of lifecycle.entries) {
      const implementation = entry.implementation as
        | HttpRuntimeFunction
        | undefined;

      if (entry.entryKind === "provider" && implementation) {
        const value = await implementation(context);
        context = withState(context, entry.name, value);
        continue;
      }

      if (entry.entryKind === "guard" && implementation) {
        const allowed = await implementation(context);
        if (allowed === false) {
          return { status: 403, body: { error: "Forbidden" } };
        }
        continue;
      }

      if (entry.entryKind === "pipe" && implementation) {
        const body = await implementation(context.request.body, context);
        context = {
          ...context,
          request: {
            ...context.request,
            body,
          },
        };
        continue;
      }

      if (entry.entryKind === "interceptor" && implementation) {
        await implementation(context);
      }
    }

    return normalizeHttpExecutionResult(
      await (route.handler as HttpRuntimeFunction)(context),
    );
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
        return normalizeHttpExecutionResult(handled);
      }
    }

    throw error;
  }
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

const withState = (
  context: HttpExecutionContext,
  key: string,
  value: unknown,
): HttpExecutionContext => ({
  ...context,
  state: {
    ...context.state,
    [key]: value,
  },
});
