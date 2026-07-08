import { mergeLifecycleDescriptors } from "@smitejs/core";
import type {
  ExpressControllerDescriptor,
  ExpressRouteDescriptor,
  ExpressRuntimeModule,
  ExpressRuntimeModuleOptions,
} from "./types.js";

const INDENT = "  ";

export const emitExpressModule = (
  controller: ExpressControllerDescriptor,
  options: ExpressRuntimeModuleOptions = {},
): ExpressRuntimeModule => {
  const appIdentifier = options.appIdentifier ?? "app";
  const handlerIdentifier = options.handlerIdentifier ?? "dependencies";
  const dependencyMap = collectDependencyKeys(controller);
  const source = [
    `import express from "express";`,
    "",
    "export interface ExpressRuntimeDependencies {",
    ...dependencyMap.map(
      (key) =>
        `${INDENT}readonly ${formatPropertyKey(key)}: (...args: readonly unknown[]) => unknown;`,
    ),
    "}",
    "",
    `export const create${capitalize(appIdentifier)} = (${handlerIdentifier}: ExpressRuntimeDependencies) => {`,
    `${INDENT}const ${appIdentifier} = express();`,
    `${INDENT}${appIdentifier}.use(express.json());`,
    "",
    ...emitRouterBlock(controller, handlerIdentifier, appIdentifier),
    `${INDENT}return ${appIdentifier};`,
    "};",
    "",
  ].join("\n");

  return {
    source,
    dependencies: dependencyMap,
  };
};

const emitRouterBlock = (
  controller: ExpressControllerDescriptor,
  handlerIdentifier: string,
  appIdentifier: string,
): string[] => {
  const routerName = `${appIdentifier}Router`;
  const lines = [`${INDENT}const ${routerName} = express.Router();`, ""];

  for (const route of controller.routes) {
    lines.push(...emitRoute(route, controller, handlerIdentifier, routerName));
    lines.push("");
  }

  lines.push(
    `${INDENT}${appIdentifier}.use(${formatString(controller.path)}, ${routerName});`,
  );

  return lines;
};

const emitRoute = (
  route: ExpressRouteDescriptor,
  controller: ExpressControllerDescriptor,
  handlerIdentifier: string,
  routerName: string,
): string[] => {
  const lifecycle = mergeLifecycleDescriptors(
    controller.lifecycle,
    route.lifecycle,
  );
  const dependencies = collectLifecycleDependencyKeys(lifecycle);
  const handlerKey = getDependencyKey(route.handler.name, "handler");
  const routeMethod = route.method.toLowerCase();
  const lines = [
    `${INDENT}${routerName}.${routeMethod}(${formatString(route.path)}, async (req, res, next) => {`,
    `${INDENT}${INDENT}try {`,
  ];

  for (const key of dependencies.filter(
    (dependency) => dependency.kind !== "filter",
  )) {
    if (key.kind === "pipe") {
      lines.push(
        `${INDENT}${INDENT}${INDENT}req.body = await ${handlerIdentifier}[${formatString(key.key)}](req.body, { req, res, next });`,
      );
      continue;
    }

    if (key.kind === "guard") {
      lines.push(
        `${INDENT}${INDENT}${INDENT}const ${key.identifier}Result = await ${handlerIdentifier}[${formatString(key.key)}](req, { req, res, next });`,
        `${INDENT}${INDENT}${INDENT}if (${key.identifier}Result === false) {`,
        `${INDENT}${INDENT}${INDENT}${INDENT}res.status(403).end();`,
        `${INDENT}${INDENT}${INDENT}${INDENT}return;`,
        `${INDENT}${INDENT}${INDENT}}`,
      );
      continue;
    }

    if (key.kind === "interceptor") {
      lines.push(
        `${INDENT}${INDENT}${INDENT}await ${handlerIdentifier}[${formatString(key.key)}]({ req, res, next, handler: ${handlerIdentifier}[${formatString(handlerKey)}] });`,
      );
      continue;
    }

    if (key.kind === "provider") {
      lines.push(
        `${INDENT}${INDENT}${INDENT}void ${handlerIdentifier}[${formatString(key.key)}];`,
      );
    }
  }

  lines.push(
    `${INDENT}${INDENT}${INDENT}const result = await ${handlerIdentifier}[${formatString(handlerKey)}](req, res, next);`,
    `${INDENT}${INDENT}${INDENT}if (!res.headersSent && result !== undefined) {`,
    `${INDENT}${INDENT}${INDENT}${INDENT}res.json(result);`,
    `${INDENT}${INDENT}${INDENT}}`,
    `${INDENT}${INDENT}} catch (error) {`,
  );

  const filters = dependencies.filter(
    (dependency) => dependency.kind === "filter",
  );

  if (filters.length === 0) {
    lines.push(`${INDENT}${INDENT}${INDENT}next(error);`);
  } else {
    lines.push(
      `${INDENT}${INDENT}${INDENT}let handled = false;`,
      ...filters.flatMap((dependency, index) => [
        `${INDENT}${INDENT}${INDENT}if (!handled) {`,
        `${INDENT}${INDENT}${INDENT}${INDENT}const response${index} = await ${handlerIdentifier}[${formatString(dependency.key)}](error, { req, res, next });`,
        `${INDENT}${INDENT}${INDENT}${INDENT}if (response${index} !== undefined) {`,
        `${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}handled = true;`,
        `${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}if (typeof response${index} === "object" && response${index} !== null) {`,
        `${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}res.status((response${index} as { readonly status?: number }).status ?? 500).json(response${index});`,
        `${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}} else {`,
        `${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}res.status(500).end();`,
        `${INDENT}${INDENT}${INDENT}${INDENT}${INDENT}}`,
        `${INDENT}${INDENT}${INDENT}${INDENT}}`,
        `${INDENT}${INDENT}${INDENT}}`,
      ]),
      `${INDENT}${INDENT}${INDENT}if (!handled) {`,
      `${INDENT}${INDENT}${INDENT}${INDENT}next(error);`,
      `${INDENT}${INDENT}${INDENT}}`,
    );
  }

  lines.push(
    `${INDENT}${INDENT}}`,
    `${INDENT}${INDENT}catch (nextError) {`,
    `${INDENT}${INDENT}${INDENT}next(nextError);`,
    `${INDENT}${INDENT}}`,
    `${INDENT}});`,
  );

  return lines;
};

type LifecycleDependencyDescriptor =
  | {
      readonly kind: "guard";
      readonly key: string;
      readonly identifier: string;
    }
  | {
      readonly kind: "filter";
      readonly key: string;
      readonly identifier: string;
    }
  | {
      readonly kind: "interceptor";
      readonly key: string;
      readonly identifier: string;
    }
  | {
      readonly kind: "pipe";
      readonly key: string;
      readonly identifier: string;
    }
  | {
      readonly kind: "provider";
      readonly key: string;
      readonly identifier: string;
    };

const collectDependencyKeys = (
  controller: ExpressControllerDescriptor,
): readonly string[] => {
  const keys: string[] = [];
  const seen = new Set<string>();

  const addKey = (key: string): void => {
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    keys.push(key);
  };

  for (const route of controller.routes) {
    for (const dependency of collectLifecycleDependencyKeys(
      mergeLifecycleDescriptors(controller.lifecycle, route.lifecycle),
    )) {
      addKey(dependency.key);
    }

    addKey(getDependencyKey(route.handler.name, "handler"));
  }

  return keys;
};

const collectLifecycleDependencyKeys = (
  lifecycle: ExpressControllerDescriptor["lifecycle"],
): readonly LifecycleDependencyDescriptor[] => {
  const dependencies: LifecycleDependencyDescriptor[] = [];
  const used = new Set<string>();

  for (const entry of lifecycle.entries) {
    const key = getDependencyKey(entry.name, entry.entryKind);
    if (used.has(key)) {
      continue;
    }

    used.add(key);
    dependencies.push({
      kind: entry.entryKind,
      key,
      identifier: toIdentifier(key),
    });
  }

  return dependencies;
};

const getDependencyKey = (name: string, fallback: string): string => {
  const normalized = name.trim();
  return normalized.length > 0 ? normalized : fallback;
};

const toIdentifier = (value: string): string => {
  const normalized = value.replace(/[^A-Za-z0-9_$]/g, "_");
  const first = normalized.replace(/^[^A-Za-z_$]+/, "");
  return first.length > 0 ? first : "_";
};

const formatPropertyKey = (value: string): string => {
  if (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(value)) {
    return value;
  }

  return formatString(value);
};

const formatString = (value: string): string => JSON.stringify(value);

const capitalize = (value: string): string =>
  value.length === 0
    ? value
    : `${value[0]?.toUpperCase() ?? ""}${value.slice(1)}`;
