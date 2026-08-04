import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { basename, dirname, extname, relative, resolve } from "node:path";
import {
  cloudFormationResourceOf,
  logicalIdOf,
  permissionReferenceOf,
  referenceOf,
} from "@smite/aws";
import type {
  AwsPermissionDescriptor,
  AwsResourceDescriptor,
} from "@smite/aws";
import type { SmitePlugin } from "@smite/cli";
import type { CompiledEntry } from "@smite/cli";
import type { AppDescriptor } from "@smite/core";
import { routesOf } from "@smite/http";

/** A Serverless Framework HTTP API event. */
export interface ServerlessHttpEvent {
  readonly path: string;
  readonly method: string;
}

/** A function entry emitted into `serverless.yml`. */
export interface ServerlessFunction {
  /** Built module and export, for example `dist/handler.handler`. */
  readonly handler: string;
  /** Compiled app key whose routes become HTTP API events. */
  readonly app?: string;
  /** Explicit events replace route-derived events. */
  readonly events?: readonly ServerlessHttpEvent[];
}

/** Options for the {@link serverless} deployment plugin. */
export interface ServerlessOptions {
  readonly service: string;
  /** Optional overrides. When omitted, functions are derived from config entries. */
  readonly functions?: Readonly<Record<string, ServerlessFunction>>;
  readonly outfile?: string;
  /** Runtime bundle directory. Defaults to `build.outdir` or `dist`. */
  readonly outdir?: string;
  /** Exported handler name. Defaults to `handler`. */
  readonly handlerExport?: string;
  readonly runtime?: string;
  readonly region?: string;
  readonly stage?: string;
  /** Serverless Framework executable. Defaults to `serverless`. */
  readonly command?: string;
}

type ServerlessPluginContext = {
  readonly entries?: readonly string[];
  readonly buildEntries?: readonly string[];
  readonly build?: { readonly outdir?: string };
  readonly compiledEntries?: readonly CompiledEntry[];
};

const scalar = (value: string): string =>
  /^[A-Za-z0-9_./:@+{}-]+$/.test(value)
    ? value
    : `'${value.replaceAll("'", "''")}'`;

const eventPath = (path: string): string =>
  path.replace(/:([A-Za-z0-9_]+)/g, "{$1}");

const functionName = (entry: string): string => {
  const name = basename(entry, extname(entry));
  return name.replace(/[^A-Za-z0-9_-]/g, "-");
};

const handlerPath = (
  entry: string,
  outdir: string,
  handlerExport: string,
): string => {
  const relativeEntry = relative(process.cwd(), resolve(process.cwd(), entry))
    .replaceAll("\\", "/")
    .replace(/^src\//, "");
  const withoutExtension = relativeEntry.slice(
    0,
    relativeEntry.length - extname(relativeEntry).length,
  );
  return `${outdir}/${withoutExtension}.${handlerExport}`;
};

const appFor = (
  apps: readonly AppDescriptor[],
  name: string | undefined,
): AppDescriptor | undefined => {
  if (name !== undefined) return apps.find((app) => app.__key === name);
  return apps.length === 1 ? apps[0] : undefined;
};

const eventsFor = (
  apps: readonly AppDescriptor[],
  functionConfig: ServerlessFunction,
): readonly ServerlessHttpEvent[] => {
  if (functionConfig.events !== undefined) return functionConfig.events;
  const app = appFor(apps, functionConfig.app);
  if (app === undefined) return [];
  return routesOf(app).flatMap((route) =>
    route.endpoints.map((endpoint) => ({
      path: eventPath(endpoint.path),
      method: endpoint.method.toLowerCase(),
    })),
  );
};

const yamlKey = (key: string): string =>
  /^[A-Za-z0-9_.-]+$/.test(key) ? key : scalar(key);

const yamlLines = (value: unknown, indent = 0): string[] => {
  const prefix = " ".repeat(indent);
  if (value === null || value === undefined) return [`${prefix}null`];
  if (typeof value !== "object") return [`${prefix}${scalar(String(value))}`];
  if (Array.isArray(value)) {
    return value.flatMap((item) => {
      if (item !== null && typeof item === "object") {
        const entries = Object.entries(item);
        const first = entries[0];
        if (first === undefined) return [`${prefix}- {}`];
        const [key, nested] = first;
        const rest = entries.slice(1);
        const firstLines = yamlLines(nested, indent + 4);
        const firstSuffix =
          firstLines.length === 1 ? `: ${firstLines[0]?.trim()}` : ":";
        const lines = [`${prefix}- ${yamlKey(key)}${firstSuffix}`];
        if (firstLines.length > 1) lines.push(...firstLines);
        for (const [restKey, restValue] of rest) {
          const nestedLines = yamlLines(restValue, indent + 2);
          lines.push(
            `${" ".repeat(indent + 2)}${yamlKey(restKey)}${
              nestedLines.length === 1
                ? `: ${nestedLines[0]?.trim()}`
                : `:\n${nestedLines.join("\n")}`
            }`,
          );
        }
        return lines;
      }
      return [`${prefix}- ${scalar(String(item))}`];
    });
  }
  const entries = Object.entries(value);
  if (entries.length === 0) return [`${prefix}{}`];
  return entries.flatMap(([key, nested]) => {
    const nestedLines = yamlLines(nested, indent + 2);
    return [
      `${prefix}${yamlKey(key)}${
        nestedLines.length === 1
          ? `: ${nestedLines[0]?.trim()}`
          : `:\n${nestedLines.join("\n")}`
      }`,
    ];
  });
};

const resourceDescriptorsOf = (
  compiledEntries: readonly CompiledEntry[],
): readonly AwsResourceDescriptor[] => {
  const seen = new Map<string, AwsResourceDescriptor>();
  for (const entry of compiledEntries) {
    for (const descriptor of entry.descriptors) {
      if (descriptor.__kind !== "aws.resource") continue;
      seen.set(descriptor.__key, descriptor as AwsResourceDescriptor);
    }
  }
  return [...seen.values()];
};

const permissionDescriptorsOf = (
  entry: CompiledEntry | undefined,
): readonly AwsPermissionDescriptor[] =>
  (entry?.descriptors ?? [])
    .filter((descriptor) => descriptor.__kind === "aws.permission")
    .map((descriptor) => descriptor as AwsPermissionDescriptor);

const resourceValueOf = (
  permission: AwsPermissionDescriptor,
  resources: ReadonlyMap<string, AwsResourceDescriptor>,
  actions: readonly string[] = permission.data.actions,
): unknown => {
  const target = permission.data.target;
  if (permission.data.resourceKey !== undefined) {
    const resource = resources.get(permission.data.resourceKey);
    if (resource !== undefined) {
      return permissionReferenceOf(resource, actions);
    }
  }
  return typeof target === "string" ? target : target;
};

const logicalFunctionId = (name: string): string =>
  `${name}Role`
    .replace(/[^A-Za-z0-9]/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`)
    .join("");

const yamlFor = (
  apps: readonly AppDescriptor[],
  options: ServerlessOptions,
  functions: Readonly<Record<string, ServerlessFunction>>,
  compiledEntries: readonly CompiledEntry[],
): string => {
  const descriptors = resourceDescriptorsOf(compiledEntries);
  const resources = new Map(
    descriptors.map((descriptor) => [descriptor.__key, descriptor]),
  );
  const cloudResources: Record<string, unknown> = {};
  const outputs: Record<string, unknown> = {};
  for (const descriptor of descriptors) {
    if (descriptor.data.resource.mode === "imported") continue;
    const logicalId = logicalIdOf(descriptor);
    cloudResources[logicalId] = cloudFormationResourceOf(descriptor);
    outputs[`${logicalId}Arn`] = {
      Value: referenceOf(descriptor),
      Export: {
        Name: `${options.service}-${descriptor.data.resource.name}-Arn`,
      },
    };
  }

  const functionNodes: Record<string, unknown> = {};
  const roleResources: Record<string, unknown> = {};
  for (const [index, [name, functionConfig]] of Object.entries(
    functions,
  ).entries()) {
    const entry =
      functionConfig.app === undefined
        ? compiledEntries[index]
        : compiledEntries.find((candidate) =>
            candidate.apps.some((app) => app.__key === functionConfig.app),
          );
    const statements = permissionDescriptorsOf(entry).flatMap((permission) =>
      permission.data.actions.map((action) => ({
        Effect: "Allow",
        Action: [action],
        Resource: resourceValueOf(permission, resources, [action]),
      })),
    );
    const roleId = logicalFunctionId(name);
    roleResources[roleId] = {
      Type: "AWS::IAM::Role",
      Properties: {
        AssumeRolePolicyDocument: {
          Version: "2012-10-17",
          Statement: [
            {
              Effect: "Allow",
              Principal: { Service: "lambda.amazonaws.com" },
              Action: "sts:AssumeRole",
            },
          ],
        },
        ManagedPolicyArns: [
          "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole",
        ],
        ...(statements.length === 0
          ? {}
          : {
              Policies: [
                {
                  PolicyName: `${name}-permissions`,
                  PolicyDocument: {
                    Version: "2012-10-17",
                    Statement: statements,
                  },
                },
              ],
            }),
      },
    };
    const events = eventsFor(apps, functionConfig);
    functionNodes[name] = {
      handler: functionConfig.handler,
      role: { "Fn::GetAtt": [roleId, "Arn"] },
      ...(events.length === 0
        ? {}
        : {
            events: events.map((event) => ({
              httpApi: { path: event.path, method: event.method },
            })),
          }),
    };
  }

  const document = {
    service: options.service,
    provider: {
      name: "aws",
      runtime: options.runtime ?? "nodejs22.x",
      ...(options.region === undefined ? {} : { region: options.region }),
      ...(options.stage === undefined ? {} : { stage: options.stage }),
    },
    functions: functionNodes,
    resources: {
      Resources: { ...cloudResources, ...roleResources },
      ...(Object.keys(outputs).length === 0 ? {} : { Outputs: outputs }),
    },
  };
  return `${yamlLines(document).join("\n")}\n`;
};

/** Writes a Serverless Framework configuration for compiled Smite apps. */
export async function writeServerlessConfig(
  apps: readonly AppDescriptor[],
  options: ServerlessOptions,
  context: ServerlessPluginContext = {},
): Promise<string> {
  const outfile = resolve(process.cwd(), options.outfile ?? "serverless.yml");
  const entries = context.buildEntries ?? context.entries ?? [];
  const compiledEntries = context.compiledEntries ?? [];
  const functions =
    options.functions ??
    Object.fromEntries(
      entries.map((entry, index) => {
        const app = compiledEntries[index]?.apps[0] ?? apps[index];
        return [
          functionName(entry),
          {
            handler: handlerPath(
              entry,
              options.outdir ?? context.build?.outdir ?? "dist",
              options.handlerExport ?? "handler",
            ),
            ...(app === undefined ? {} : { app: app.__key }),
          },
        ];
      }),
    );
  await mkdir(dirname(outfile), { recursive: true });
  await writeFile(
    outfile,
    yamlFor(apps, options, functions, compiledEntries),
    "utf8",
  );
  return outfile;
}

const runServerless = (command: string, outfile: string): Promise<void> =>
  new Promise((resolvePromise, reject) => {
    const child = spawn(command, ["deploy", "--config", outfile], {
      cwd: process.cwd(),
      stdio: "inherit",
    });
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) resolvePromise();
      else {
        reject(
          new Error(`Serverless deploy exited with code ${code ?? "unknown"}.`),
        );
      }
    });
  });

/**
 * Creates a CLI plugin that emits `serverless.yml` and deploys it with the
 * Serverless Framework. Other infrastructure tools can implement the same
 * optional deployment hook without changing the Smite app or CLI.
 *
 * @group Deployment
 * @example Configure the Serverless Framework plugin
 */
export function serverless(options: ServerlessOptions): SmitePlugin {
  const outfile = options.outfile ?? "serverless.yml";
  return {
    name: "serverless",
    async run(context) {
      await writeServerlessConfig(context.apps, options, context);
    },
    deploy: () =>
      runServerless(
        options.command ?? "serverless",
        resolve(process.cwd(), outfile),
      ),
  };
}
