import {
    defineDescriptor,
    DescriptorKind,
    type Descriptor,
} from "@core/descriptor";
import type { Context } from "aws-lambda";

export interface GuardResult {
    event: any;
    context: Context;
}

export interface GuardDescriptorData {
    name: string;
    handler: (event: any, context: Context) => Promise<GuardResult>;
}

export type GuardDescriptor = Descriptor<
    DescriptorKind.guard,
    GuardDescriptorData
>;

/**
 * Describes a guard that can be used to protect routes or resources.
 * Guards are executed before the main handler and can modify the event,
 * context, or even terminate the request early.
 */
export function defineGuard(descriptor: GuardDescriptorData) {
    return defineDescriptor(DescriptorKind.guard, descriptor.name, descriptor);
}
