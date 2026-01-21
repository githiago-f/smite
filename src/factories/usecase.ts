import { defineDescriptor, DescriptorKind } from "@core/descriptor";

export type UseCaseHandler<I, O> = (input: I) => Promise<O>;

export interface UseCaseDescriptorData<Input, Output> {
    name: string;
    handler: UseCaseHandler<Input, Output>;
}

export function defineUseCase<I, O>(descriptor: UseCaseDescriptorData<I, O>) {
    return defineDescriptor(
        DescriptorKind.usecase,
        descriptor.name,
        descriptor,
    );
}
