import { defineDescriptor, DescriptorKind } from "@core/descriptor";
import type { HandlerDescriptor, HandlerDescriptorData } from "./type";

export type { HandlerDescriptor } from "./type";

export function defineHandler(
    name: string,
    handler: HandlerDescriptorData,
): HandlerDescriptor {
    return defineDescriptor(DescriptorKind.handler, name, handler);
}
