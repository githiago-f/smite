import type { Descriptor, DescriptorKind } from "@core/descriptor";
import type { RequestContext } from "@factories/route";
import type { Context } from "aws-lambda";

export interface GuardResult {
    event?: any;
    awsContext?: Context;
    requestContext?: RequestContext;
}

export interface GuardDescriptorData {
    name: string;

    /**
     * @returns {Promise<GuardResult>} - a partial object that contains only changed data.
     *  -> if it wasn´t changed, it can return `{}`
     */
    handler(event: any, context: Context): Promise<GuardResult>;
}

export type GuardDescriptor = Descriptor<
    DescriptorKind.guard,
    GuardDescriptorData
>;
