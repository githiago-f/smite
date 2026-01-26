import type { Descriptor, DescriptorKind } from "@core/descriptor";
import type { Context } from "aws-lambda";

export interface GuardResult {
    event: any;
    awsContext: Context;
}

export interface GuardDescriptorData {
    name: string;
    handler: (event: any, context: Context) => Promise<GuardResult>;
}

export type GuardDescriptor = Descriptor<
    DescriptorKind.guard,
    GuardDescriptorData
>;
