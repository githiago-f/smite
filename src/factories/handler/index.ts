import { defineDescriptor, DescriptorKind } from "@core/descriptor";
import type { HandlerDescriptor, HandlerDescriptorData } from "./type";

export type { HandlerDescriptor } from "./type";

export function defineHandler<T>(handler: HandlerDescriptorData<T>): HandlerDescriptor {
    return defineDescriptor(DescriptorKind.handler, handler.name, handler);
}
