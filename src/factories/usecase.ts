import { defineDescriptor, DescriptorKind } from "@core/descriptor";
import type { ZodMiniType } from "zod/v4-mini";

export type UseCaseHandler<I, O> = (input: I) => Promise<O>;

export interface UseCaseDescriptorData<Input, Output> {
    name: string;
    input: ZodMiniType<Input>;
    output: ZodMiniType<Output>;
    execute: UseCaseHandler<Input, Output>;
}

export function defineUseCase<I, O>(descriptor: UseCaseDescriptorData<I, O>) {
    return defineDescriptor(
        DescriptorKind.usecase,
        descriptor.name,
        descriptor,
    );
}
