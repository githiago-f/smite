import type { Descriptor, DescriptorKind } from "@core/descriptor";
import type { HandlerParams } from "@core/helpers/handler-type";

export interface HandlerDescriptorData {
    eventHandler: <T>(...args: HandlerParams) => Promise<T>;
}

export type HandlerDescriptor = Descriptor<
    DescriptorKind.handler,
    HandlerDescriptorData
>;
