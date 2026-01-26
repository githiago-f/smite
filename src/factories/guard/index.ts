import { defineDescriptor, DescriptorKind } from "@core/descriptor";
import type { GuardDescriptorData } from "./type";

export type { GuardDescriptor } from "./type";

/**
 * Describes a guard that can be used to protect routes or resources.
 * Guards are executed before the main handler and can modify the event,
 * context, or even terminate the request early.
 */
export function defineGuard(descriptor: GuardDescriptorData) {
    return defineDescriptor(DescriptorKind.guard, descriptor.name, descriptor);
}
