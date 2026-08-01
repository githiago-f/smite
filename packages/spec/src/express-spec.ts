import type {
  HttpControllerDescriptor,
  HttpRouteDescriptor,
  LifecycleCompositionDescriptor,
  LifecycleEntry,
} from "@smite/core";
import { mergeLifecycleDescriptors } from "@smite/core";
import type { ControllerSource } from "./normalize.js";
import { resolveControllers } from "./normalize.js";

/**
 * Renders the platform-native Express specification for HTTP controllers.
 *
 * The output mirrors what a runtime emitter generates: one Express router per
 * controller, mounted at its controller path, with every route registered
 * natively and its merged lifecycle listed in core execution order.
 *
 * @group Specifications
 * @intent Projects Smite HTTP descriptors into the Express runtime wiring specification.
 * @example Express specification
 */
export const renderExpressSpec = (
  controllers: readonly ControllerSource[],
): string => {
  const resolved = resolveControllers(controllers);
  const lines: string[] = [];

  lines.push("# Express Specification");
  lines.push("");
  lines.push(
    "Source: `@smite/spec` — deterministic Express wiring for Smite HTTP descriptors.",
  );
  lines.push(
    `Generated from ${resolved.length} ${
      resolved.length === 1 ? "controller" : "controllers"
    }.`,
  );
  lines.push("");
  lines.push("## Mounting");
  lines.push("");
  lines.push(
    "Each controller becomes a native Express router mounted at its controller path.",
  );
  lines.push("");

  if (resolved.length === 0) {
    lines.push("- none");
  } else {
    for (const controller of resolved) {
      lines.push(
        `- app.use("${controller.path}", ${routerName(controller.path)})`,
      );
    }
  }

  lines.push("");

  for (const controller of resolved) {
    lines.push(`## ${routerName(controller.path)} — ${controller.path}`);
    lines.push("");
    lines.push("| Method | Path | Handler |");
    lines.push("|--------|------|---------|");

    for (const route of controller.routes) {
      lines.push(`| ${route.method} | ${route.path} | ${handlerName(route)} |`);
    }

    lines.push("");

    for (const route of controller.routes) {
      lines.push(`### ${route.method} ${route.path} — merged lifecycle`);
      lines.push("");
      renderLifecycle(
        mergeLifecycleDescriptors(controller.lifecycle, route.lifecycle),
        lines,
      );
      lines.push("");
    }
  }

  return `${lines.join("\n").trimEnd()}\n`;
};

const renderLifecycle = (
  lifecycle: LifecycleCompositionDescriptor,
  lines: string[],
): void => {
  if (lifecycle.entries.length === 0) {
    lines.push("1. none");
    return;
  }

  lifecycle.entries.forEach((entry: LifecycleEntry, index: number) => {
    const suffix = entry.entryKind === "filter" ? " — runs only on error" : "";
    lines.push(`${index + 1}. ${entry.entryKind}: ${entry.name}${suffix}`);
  });
};

const handlerName = (route: HttpRouteDescriptor): string =>
  route.handler.name.length > 0 ? route.handler.name : "<anonymous>";

const routerName = (path: string): string => {
  const slug = path
    .replace(/^\/+/, "")
    .split("/")
    .filter((segment) => segment.length > 0)
    .map((segment) => segment.replace(/[^a-zA-Z0-9]/g, "-"))
    .join("-")
    .toLowerCase();

  return slug.length === 0 ? "appRouter" : `${slug}Router`;
};
