import type { Descriptor, DescriptorKind } from "@core/descriptor";
import type { Handler } from "aws-lambda";
import type { infer as Infer, ZodType } from 'zod/v4';

type P = Parameters<Handler>;

type Event<EventType, _Handler extends { input: Record<keyof EventType, ZodType> }> = {
    [K in keyof _Handler['input']]: Infer<_Handler['input'][K]>
}

export interface HandlerDescriptorData<EventType = any> {
    name: string;
    input: { [K in keyof EventType]: ZodType<EventType> },
    eventHandler(event: Event<EventType, HandlerDescriptorData<EventType>>, context: P[1], callback: P[2]): Promise<any>;
}

export type HandlerDescriptor = Descriptor<
    DescriptorKind.handler,
    HandlerDescriptorData
>;
