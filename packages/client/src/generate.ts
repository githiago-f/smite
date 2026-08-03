import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { childrenOf, clear, lookupAll } from "@smite/core";
import * as esbuild from "esbuild";
import { extractPathParams } from "./path-params.js";

/**
 * Options for `generate()`.
 *
 * @group Codegen
 */
export interface GenerateOptions {
  readonly entry: string;
  readonly outfile: string;
  readonly appName?: string;
  readonly alias?: Readonly<Record<string, string>>;
}

interface CollectedEndpoint {
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
 * Compiles the app entry in collect mode, executes it, traverses
 * `globalThis.globalRegistry`, and emits a builder-style typed client to
 * `outfile`. Returns the generated source.
 *
 * @group Codegen
 * @example Generate a typed client
 */
export async function generate(options: GenerateOptions): Promise<string> {
  const cwd = process.cwd();
  const entry = resolve(cwd, options.entry);
  const outfile = resolve(cwd, options.outfile);

  const dir = await mkdtemp(join(tmpdir(), "smite-client-"));
  const bundlePath = join(dir, "app.cjs");

  await esbuild.build({
    entryPoints: [entry],
    outfile: bundlePath,
    bundle: true,
    platform: "node",
    format: "cjs",
    target: "es2022",
    define: { ALLOW_GLOBAL_REGISTRY: "true" },
    absWorkingDir: cwd,
    ...(options.alias === undefined ? {} : { alias: options.alias }),
  });

  clear();
  await import(pathToFileURL(bundlePath).href);

  const apps = lookupAll("app");
  if (apps.length === 0) {
    throw new Error(
      "No app found in the registry. The entry must call http.app() at module scope.",
    );
  }
  const app =
    apps.length === 1
      ? apps[0]
      : apps.find((candidate) => candidate.__key === options.appName);
  if (app === undefined) {
    throw new Error(
      apps.length > 1
        ? `Multiple apps found (${apps
            .map((candidate) => candidate.__key)
            .join(", ")}). Pass an appName.`
        : `App '${options.appName}' was not found in the registry.`,
    );
  }

  const endpoints: CollectedEndpoint[] = [];
  // TODO: read route.data.req (zod schemas) during collection so the emitted
  // query/body/headers buckets can be inferred from the route config instead of
  // loose records (roadmap follow-up, see 17_client.md "Types").
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

  const root = buildTree(endpoints);
  checkCollisions(root, "");
  const tree = emitNode(root, "");

  const code = `import { configure, request } from "@smite/client/runtime";
import type { ClientConfig } from "@smite/client/runtime";

export { configure };

export const api = ${tree};
`;

  await mkdir(dirname(outfile), { recursive: true });
  await writeFile(outfile, code, "utf8");
  return code;
}
