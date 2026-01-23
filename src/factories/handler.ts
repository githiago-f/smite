import {
    defineDescriptor,
    type Descriptor,
    DescriptorKind,
} from "@core/descriptor";
import type { Handler } from "aws-lambda";

export interface HandlerDescriptorData {
    handler: (...args: Parameters<Handler>) => Promise<unknown>;
}

export type HandlerDescriptor = Descriptor<
    DescriptorKind.handler,
    HandlerDescriptorData
>;

export function defineHandler(
    name: string,
    handler: HandlerDescriptorData,
): HandlerDescriptor {
    return defineDescriptor(DescriptorKind.handler, name, handler);
}
