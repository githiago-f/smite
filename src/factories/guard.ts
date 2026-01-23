import {
    defineDescriptor,
    DescriptorKind,
    type Descriptor,
} from "@core/descriptor";
import type { APIGatewayProxyEvent, Handler } from "aws-lambda";

export interface GuardDescriptorData {
    name: string;
    handler: Handler<APIGatewayProxyEvent>;
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
