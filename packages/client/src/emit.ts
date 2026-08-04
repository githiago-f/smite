import { childrenOf } from "@smitejs/core";
import type { AppDescriptor } from "@smitejs/core";
import { extractPathParams } from "./path-params.js";

/**
 * A collected endpoint: its method, path template, and path params.
 *
 * @group Codegen
 */
export interface CollectedEndpoint {
  readonly method: string;
  readonly path: string;
  readonly pathParams: readonly string[];
}

interface TreeNode {
  readonly namespaces: Map<string, TreeNode>;
  readonly methods: Map<string, CollectedEndpoint>;
}

const IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

const keyLiteral = (key: string): string =>
  IDENTIFIER.test(key) ? key : JSON.stringify(key);

const methodKey = (method: string): string => `$${method.toLowerCase()}`;

const emitMethod = (endpoint: CollectedEndpoint, indent: string): string => {
  const params =
    endpoint.pathParams.length > 0
      ? `params: { ${endpoint.pathParams
          .map((param) => `${keyLiteral(param)}: string`)
          .join("; ")} }`
      : "";
  const buckets = [
    params,
    "query?: Readonly<Record<string, unknown>>",
    "headers?: Readonly<Record<string, string>>",
    "body?: unknown",
    "$config?: ClientConfig",
  ].filter((bucket) => bucket !== "");
  const inputType = `{ ${buckets.join("; ")} }`;
  const required = params !== "";
  return `${indent}${keyLiteral(methodKey(endpoint.method))}: (input${
    required ? "" : "?"
  }: ${inputType}) => request(${JSON.stringify(endpoint.method)}, ${JSON.stringify(
    endpoint.path,
  )}, input),`;
};

const emitNode = (node: TreeNode, indent: string): string => {
  const entries: string[] = [];
  for (const [key, child] of node.namespaces) {
    entries.push(
      `${indent}${keyLiteral(key)}: ${emitNode(child, `${indent}  `)},`,
    );
  }
  for (const [, endpoint] of node.methods) {
    entries.push(emitMethod(endpoint, indent));
  }
  return `{\n${entries.join("\n")}\n${indent}}`;
};

const checkCollisions = (node: TreeNode, path: string): void => {
  for (const [key, child] of node.namespaces) {
    if (node.methods.has(key)) {
      throw new Error(
        `Collision at '${path}': '${key}' is both a resource and a method.`,
      );
    }
    checkCollisions(child, `${path}/${key}`);
  }
};

const buildTree = (endpoints: readonly CollectedEndpoint[]): TreeNode => {
  const root: TreeNode = { namespaces: new Map(), methods: new Map() };
  for (const endpoint of endpoints) {
    const segments = endpoint.path.split("/").filter((s) => s.length > 0);
    let node = root;
    for (const segment of segments) {
      const key = segment.startsWith(":") ? `$${segment.slice(1)}` : segment;
      let child = node.namespaces.get(key);
      if (child === undefined) {
        child = { namespaces: new Map(), methods: new Map() };
        node.namespaces.set(key, child);
      }
      node = child;
    }
    node.methods.set(methodKey(endpoint.method), endpoint);
  }
  return root;
};

/**
 * Traverses an app descriptor's `http.route`/`http.endpoint` children and
 * returns the collected endpoints. `ANY` endpoints are skipped with a warning.
 *
 * @group Codegen
 */
export function collectEndpoints(
  app: AppDescriptor,
): readonly CollectedEndpoint[] {
  const endpoints: CollectedEndpoint[] = [];
  for (const route of childrenOf(app, "http.route")) {
    for (const endpoint of childrenOf(route, "http.endpoint")) {
      const data = endpoint.data as {
        readonly method: string;
        readonly path: string;
      };
      if (data.method === "ANY") {
        console.warn(`Skipping ANY endpoint '${data.path}'.`);
        continue;
      }
      endpoints.push({
        method: data.method,
        path: data.path,
        pathParams: extractPathParams(data.path),
      });
    }
  }
  return endpoints;
}

/**
 * Collects endpoints across every compiled app, in order.
 *
 * @group Codegen
 */
export function collectEndpointsFromApps(
  apps: readonly AppDescriptor[],
): readonly CollectedEndpoint[] {
  return apps.flatMap((app) => collectEndpoints(app));
}

/**
 * Renders the builder-client source for a set of endpoints.
 *
 * @group Codegen
 */
export function emitClient(endpoints: readonly CollectedEndpoint[]): string {
  const root = buildTree(endpoints);
  checkCollisions(root, "");
  const tree = emitNode(root, "");

  return `import { configure, request } from "@smitejs/client/runtime";
import type { ClientConfig } from "@smitejs/client/runtime";

export { configure };

export const api = ${tree};
`;
}
