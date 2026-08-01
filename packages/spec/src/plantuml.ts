import type {
  HttpControllerDescriptor,
  HttpRouteDescriptor,
  LifecycleEntry,
} from "@smite/core";
import { mergeLifecycleDescriptors } from "@smite/core";
import type { ControllerSource } from "./normalize.js";
import { resolveControllers } from "./normalize.js";

/**
 * Renders a PlantUML component diagram for HTTP controllers.
 *
 * Each controller becomes a component holding one nested component per route.
 * Merged lifecycle entries are rendered as separate components, with edges from
 * every route in core execution order. Filters are marked as error-only edges.
 *
 * @group Specifications
 * @intent Projects Smite HTTP descriptors into a deterministic PlantUML documentation diagram.
 * @example PlantUML specification
 */
export const renderPlantUml = (
  controllers: readonly ControllerSource[],
): string => {
  const resolved = resolveControllers(controllers);
  const lines: string[] = [];

  lines.push("@startuml");
  lines.push("title Smite HTTP application");
  lines.push("");

  if (resolved.length === 0) {
    lines.push('note "No controllers" as empty');
    lines.push("@enduml");
    return `${lines.join("\n")}\n`;
  }

  const projections = collectProjections(resolved);
  const lifecycle = collectLifecycle(projections);
  const lifecycleAliases = new Map<string, number>();

  lifecycle.forEach((entry, index) => {
    lifecycleAliases.set(lifecycleKey(entry), index);
  });

  lines.push("' Controllers and routes");
  for (const [index, controller] of resolved.entries()) {
    lines.push(`component "${controller.path}" as c${index} {`);
    for (const [routeIndex, route] of controller.routes.entries()) {
      lines.push(
        `  component "${routeLabel(route)}" as c${index}r${routeIndex}`,
      );
    }
    lines.push("}");
  }

  lines.push("");
  lines.push("' Merged lifecycle entries");

  for (const entry of lifecycle) {
    lines.push(
      `component "${entry.entryKind}: ${entry.name}" as lc${lifecycleAliases.get(lifecycleKey(entry))}`,
    );
  }

  lines.push("");
  lines.push(
    "' Route execution order (merged lifecycle, controller then route)",
  );

  for (const projection of projections) {
    for (const entry of projection.entries) {
      lines.push(
        `c${projection.controllerIndex}r${projection.routeIndex} --> lc${lifecycleAliases.get(lifecycleKey(entry))}`,
      );
    }
  }

  lines.push("");
  lines.push("' Filters run only on error");

  for (const projection of projections) {
    for (const entry of projection.entries) {
      if (entry.entryKind !== "filter") {
        continue;
      }
      lines.push(
        `c${projection.controllerIndex}r${projection.routeIndex} --> lc${lifecycleAliases.get(lifecycleKey(entry))} : on error`,
      );
    }
  }

  lines.push("@enduml");

  return `${lines.join("\n")}\n`;
};

interface RouteProjection {
  readonly controllerIndex: number;
  readonly routeIndex: number;
  readonly entries: readonly LifecycleEntry[];
}

const collectProjections = (
  controllers: readonly HttpControllerDescriptor[],
): readonly RouteProjection[] => {
  const projections: RouteProjection[] = [];

  controllers.forEach((controller, controllerIndex) => {
    controller.routes.forEach((route: HttpRouteDescriptor, routeIndex) => {
      projections.push({
        controllerIndex,
        routeIndex,
        entries: mergeLifecycleDescriptors(
          controller.lifecycle,
          route.lifecycle,
        ).entries,
      });
    });
  });

  return projections;
};

const collectLifecycle = (
  projections: readonly RouteProjection[],
): readonly LifecycleEntry[] => {
  const entries: LifecycleEntry[] = [];
  const seen = new Set<string>();

  for (const projection of projections) {
    for (const entry of projection.entries) {
      const key = lifecycleKey(entry);

      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      entries.push(entry);
    }
  }

  return entries;
};

const lifecycleKey = (entry: LifecycleEntry): string =>
  `${entry.entryKind}:${entry.name}`;

const routeLabel = (route: HttpRouteDescriptor): string => {
  const handler =
    route.handler.name.length > 0 ? route.handler.name : "<anonymous>";
  return `${route.method} ${route.path} -> ${handler}`;
};
