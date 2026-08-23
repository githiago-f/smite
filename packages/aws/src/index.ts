import { defineDescriptor } from "@smitejs/core";
import type { Descriptor } from "@smitejs/core";
import { getProviderConfig } from "./context.js";
import type { ProviderConfig } from "./context.js";

export { getProviderConfig, runWithProviderConfig } from "./context.js";
export type { ProviderConfig } from "./context.js";

/** AWS services supported by the first resource provider layer. */
export type AwsProviderName = "s3" | "ssm" | "dynamodb" | "sqs" | "eventbridge";

/** Resource ownership mode used by deployment adapters. */
export type AwsResourceMode = "managed" | "imported";

/** Configuration shared by every AWS resource provider. */
export interface AwsProviderConfig {
  readonly name: string;
  readonly mode?: AwsResourceMode;
  readonly logicalId?: string;
  readonly import?: {
    readonly exportName: string;
  };
  readonly properties?: Readonly<Record<string, unknown>>;
  readonly [key: string]: unknown;
}

/** A stable reference accepted by `requirePermissions`. */
export interface AwsResourceReference {
  readonly provider: AwsProviderName;
  readonly name: string;
  readonly mode: AwsResourceMode;
  readonly descriptorKey: string;
  readonly import?: {
    readonly exportName: string;
  };
}

/** The compile-time resource node consumed by infrastructure adapters. */
export interface AwsResourceDescriptor
  extends Descriptor<
    "aws.resource",
    {
      readonly provider: AwsProviderName;
      readonly resource: AwsResourceReference;
      readonly config: AwsProviderConfig;
    }
  > {}

/** The compile-time permission node consumed by IAM generators. */
export interface AwsPermissionDescriptor
  extends Descriptor<
    "aws.permission",
    {
      readonly provider: AwsProviderName | "unknown";
      readonly resourceKey?: string;
      readonly target: string | AwsResourceReference;
      readonly actions: readonly string[];
    }
  > {}

/** A resource handle with a full user-supplied SDK client. */
export interface AwsResource<Client> {
  readonly provider: AwsProviderName;
  readonly name: string;
  readonly resource: AwsResourceReference;
  /** The compile-time descriptor backing this handle, for ARN/CloudFormation tooling. */
  readonly descriptor: AwsResourceDescriptor;
  readonly client: Client;
  readonly requirePermissions: (
    actions: readonly string[],
  ) => AwsPermissionDescriptor;
}

export type AwsPermissionTarget =
  | AwsResourceReference
  | AwsResource<unknown>
  | string;

const resourceReference = (
  providerName: AwsProviderName,
  config: AwsProviderConfig,
  descriptorKey: string,
): AwsResourceReference => ({
  provider: providerName,
  name: config.name,
  mode: config.mode ?? "managed",
  descriptorKey,
  ...(config.import === undefined ? {} : { import: config.import }),
});

const targetDetails = (
  target: AwsPermissionTarget,
): {
  readonly provider: AwsProviderName | "unknown";
  readonly resourceKey?: string;
  readonly value: string | AwsResourceReference;
} => {
  if (typeof target === "string") {
    return { provider: "unknown", value: target };
  }
  const resource = "resource" in target ? target.resource : target;
  return {
    provider: resource.provider,
    resourceKey: resource.descriptorKey,
    value: resource,
  };
};

const qualifyActions = (
  providerName: AwsProviderName | "unknown",
  actions: readonly string[],
): readonly string[] =>
  actions.map((action) =>
    providerName !== "unknown" && !action.includes(":")
      ? `${providerName}:${action}`
      : action,
  );

let permissionSequence = 0;

/**
 * Records an explicit IAM permission against a resource reference. Calls are
 * collected from the entry currently being compiled and never inspect SDK
 * calls at runtime.
 *
 * @group Permissions
 */
export function requirePermissions(
  target: AwsPermissionTarget,
  actions: readonly string[],
): AwsPermissionDescriptor {
  if (actions.length === 0) {
    throw new Error("requirePermissions() needs at least one action.");
  }
  const details = targetDetails(target);
  const qualified = qualifyActions(details.provider, actions);
  const descriptor = defineDescriptor(
    "aws.permission",
    `aws.permission:${permissionSequence++}`,
    {
      provider: details.provider,
      ...(details.resourceKey === undefined
        ? {}
        : { resourceKey: details.resourceKey }),
      target: details.value,
      actions: qualified,
    },
  );
  return descriptor as AwsPermissionDescriptor;
}

/**
 * Declares an AWS resource and returns a lazy, cached client handle. The
 * client factory belongs to the application, so no AWS SDK is required by
 * this package. The factory receives the shared provider config (region,
 * service name) registered by a configuration manager or environment.
 *
 * @group Providers
 * @example Declare an S3 provider
 */
export function provider<Client>(
  providerName: AwsProviderName,
  config: AwsProviderConfig,
  createClient: (ctx: ProviderConfig) => Client,
): AwsResource<Client> {
  if (config.mode === "imported" && config.import === undefined) {
    throw new Error(
      `Imported AWS resource '${config.name}' must define import.exportName.`,
    );
  }
  const key = `aws.resource:${providerName}:${config.name}`;
  const reference = resourceReference(providerName, config, key);
  const descriptor = defineDescriptor("aws.resource", key, {
    provider: providerName,
    resource: reference,
    config,
  }) as AwsResourceDescriptor;
  let cached: Client | undefined;
  const handle = {
    provider: providerName,
    name: config.name,
    resource: reference,
    descriptor,
    get client(): Client {
      cached ??= createClient(getProviderConfig());
      return cached;
    },
    requirePermissions: (actions: readonly string[]) =>
      requirePermissions(reference, actions),
  } as AwsResource<Client>;
  void descriptor;
  return Object.freeze(handle);
}

/** Returns a CloudFormation logical identifier for a resource. */
export const logicalIdOf = (descriptor: AwsResourceDescriptor): string =>
  descriptor.data.config.logicalId ??
  `${descriptor.data.provider}${descriptor.data.resource.name}`
    .replace(/[^A-Za-z0-9]/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`)
    .join("");

/** Returns the CloudFormation ARN expression for a resource. */
export const referenceOf = (descriptor: AwsResourceDescriptor): unknown => {
  const config = descriptor.data.config;
  if (config.arn !== undefined) return config.arn;
  if (config.import !== undefined) {
    return { "Fn::ImportValue": config.import.exportName };
  }
  return { "Fn::GetAtt": [logicalIdOf(descriptor), "Arn"] };
};

/** Returns the resource ARN expression scoped for the requested IAM actions. */
export const permissionReferenceOf = (
  descriptor: AwsResourceDescriptor,
  actions: readonly string[],
): unknown => {
  const objectActions = new Set([
    "s3:GetObject",
    "s3:PutObject",
    "s3:DeleteObject",
  ]);
  if (
    descriptor.data.provider === "s3" &&
    actions.some((action) => objectActions.has(action))
  ) {
    return {
      "Fn::Join": ["", [referenceOf(descriptor), "/*"]],
    };
  }
  return referenceOf(descriptor);
};

const providerProperties = (
  descriptor: AwsResourceDescriptor,
): Readonly<Record<string, unknown>> => {
  const config = descriptor.data.config;
  const mapped: Record<string, unknown> = {};
  const mappings: Record<string, string> = {
    bucketName: "BucketName",
    parameterName: "Name",
    parameterType: "Type",
    value: "Value",
    tableName: "TableName",
    queueName: "QueueName",
    eventBusName: "Name",
  };
  for (const [source, target] of Object.entries(mappings)) {
    if (config[source] !== undefined) mapped[target] = config[source];
  }
  return { ...mapped, ...(config.properties ?? {}) };
};

/** Returns the CloudFormation resource definition for a managed resource. */
export const cloudFormationResourceOf = (
  descriptor: AwsResourceDescriptor,
): {
  readonly Type: string;
  readonly Properties: Readonly<Record<string, unknown>>;
} => {
  const types: Record<AwsProviderName, string> = {
    s3: "AWS::S3::Bucket",
    ssm: "AWS::SSM::Parameter",
    dynamodb: "AWS::DynamoDB::Table",
    sqs: "AWS::SQS::Queue",
    eventbridge: "AWS::Events::EventBus",
  };
  return {
    Type: types[descriptor.data.provider],
    Properties: providerProperties(descriptor),
  };
};
