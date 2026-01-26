import { defineDescriptor, DescriptorKind } from "@core/descriptor";
import type { HandlerDescriptor, HandlerDescriptorData } from "./types";

export type { HandlerDescriptor } from "./types";

export function defineHandler(
    name: string,
    handler: HandlerDescriptorData,
): HandlerDescriptor {
    return defineDescriptor(DescriptorKind.handler, name, handler);
}
