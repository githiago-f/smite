import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { basename, dirname, extname, relative, resolve } from "node:path";
import {
  cloudFormationResourceOf,
  getProviderConfig,
  logicalIdOf,
  permissionReferenceOf,
  referenceOf,
  runWithProviderConfig,
} from "@smitejs/aws";
import type {
  AwsPermissionDescriptor,
  AwsResourceDescriptor,
} from "@smitejs/aws";
import type { SmitePlugin } from "@smitejs/cli";
import type { CompiledEntry } from "@smitejs/cli";
import type { AppDescriptor } from "@smitejs/core";
import { routesOf } from "@smitejs/http";
import { stringify } from "yaml";

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

/** A Serverless Framework plugin reference: an installed name or local path. */
export interface ServerlessPluginReference {
  /** Package name of an installed Serverless Framework plugin. */
  readonly name?: string;
  /** Local path to a project plugin, for example `./plugins/custom.js`. */
  readonly localPath?: string;
  /** Configuration passed to the plugin. */
  readonly config?: Readonly<Record<string, unknown>>;
}

/** A Serverless Framework plugin declaration for the emitted `plugins` block. */
export type ServerlessPluginEntry = string | ServerlessPluginReference;

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
  /** Serverless Framework plugins activated for this service. */
  readonly plugins?: readonly ServerlessPluginEntry[];
  /**
   * Raw CloudFormation template sections merged into the generated
   * `resources` block. Entries under `Resources` are added alongside the
   * resources derived from `@smitejs/aws`, so resources of any service
   * (`AWS::CloudFront::Distribution`, `AWS::Cognito::UserPool`, and so on)
   * can be declared without a managed provider.
   */
  readonly resources?: Readonly<Record<string, unknown>>;
  /** The `custom` block, typically used to configure plugins. */
  readonly custom?: Readonly<Record<string, unknown>>;
  /** Arbitrary top-level `serverless.yml` keys merged last, for example `provider` extensions or `configValidationMode`. */
  readonly extend?: Readonly<Record<string, unknown>>;
}

type ServerlessPluginContext = {
  readonly entries?: readonly string[];
  readonly buildEntries?: readonly string[];
  readonly build?: { readonly outdir?: string };
  readonly compiledEntries?: readonly CompiledEntry[];
};

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

const routerNamesOf = (app: AppDescriptor): readonly string[] =>
  routesOf(app)
    .map((route) => route.name)
    .filter((name): name is string => name !== undefined);

const eventsFor = (
  apps: readonly AppDescriptor[],
  functionConfig: ServerlessFunction,
  entryApp: AppDescriptor | undefined,
): readonly ServerlessHttpEvent[] => {
  if (functionConfig.events !== undefined) return functionConfig.events;
  const app = entryApp ?? appFor(apps, functionConfig.app);
  if (app === undefined) return [];
  return routesOf(app).flatMap((route) =>
    route.endpoints.map((endpoint) => ({
      path: eventPath(endpoint.path),
      method: endpoint.method.toLowerCase(),
    })),
  );
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

const isPlainObject = (
  value: unknown,
): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const deepMerge = (
  target: Record<string, unknown>,
  source: Readonly<Record<string, unknown>>,
): Record<string, unknown> => {
  for (const [key, value] of Object.entries(source)) {
    if (value === undefined) continue;
    const existing = target[key];
    if (isPlainObject(existing) && isPlainObject(value)) {
      target[key] = deepMerge({ ...existing }, value);
    } else {
      target[key] = value;
    }
  }
  return target;
};

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
    const entryApp =
      entry === undefined
        ? undefined
        : functionConfig.app === undefined
          ? entry.apps[0]
          : entry.apps.find((app) => app.__key === functionConfig.app);
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
    const events = eventsFor(apps, functionConfig, entryApp);
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

  const resourcesNode: Record<string, unknown> = {
    Resources: { ...cloudResources, ...roleResources },
    ...(Object.keys(outputs).length === 0 ? {} : { Outputs: outputs }),
  };
  if (options.resources !== undefined) {
    deepMerge(resourcesNode, options.resources);
  }
  const document: Record<string, unknown> = {
    service: options.service,
    provider: {
      name: "aws",
      runtime: options.runtime ?? "nodejs22.x",
      ...(options.region === undefined ? {} : { region: options.region }),
      ...(options.stage === undefined ? {} : { stage: options.stage }),
    },
    functions: functionNodes,
    resources: resourcesNode,
  };
  if (options.plugins !== undefined && options.plugins.length > 0) {
    document.plugins = options.plugins;
  }
  if (options.custom !== undefined) {
    document.custom = options.custom;
  }
  if (options.extend !== undefined) {
    deepMerge(document, options.extend);
  }
  return `${stringify(document)}\n`;
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
        const handler = handlerPath(
          entry,
          options.outdir ?? context.build?.outdir ?? "dist",
          options.handlerExport ?? "handler",
        );
        if (app === undefined) return [functionName(entry), { handler }];
        const routerNames = routerNamesOf(app);
        const name =
          routerNames.length === 1 ? routerNames[0] : functionName(entry);
        return [name, { handler, app: app.__key }];
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
 * optional deployment hook without changing the Smite app or CLI. Pass
 * `plugins`, `resources`, `custom`, or `extend` to declare Serverless
 * Framework plugins and raw CloudFormation resources of any service without
 * touching the generated document.
 *
 * @group Deployment
 * @example Configure the Serverless Framework plugin
 */
export function serverless(options: ServerlessOptions): SmitePlugin {
  const outfile = options.outfile ?? "serverless.yml";
  return {
    name: "serverless",
    async run(context) {
      const region = options.region ?? getProviderConfig().region;
      await runWithProviderConfig(
        {
          region,
          ...(options.service === undefined
            ? {}
            : { service: options.service }),
        },
        () => writeServerlessConfig(context.apps, options, context),
      );
    },
    deploy: () =>
      runServerless(
        options.command ?? "serverless",
        resolve(process.cwd(), outfile),
      ),
  };
}
