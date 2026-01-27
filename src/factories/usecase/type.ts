import type { Descriptor, DescriptorKind } from "@core/descriptor";

export type UseCaseHandler<I, O> = (input: I) => Promise<O>;

export interface UseCaseDescriptorData<Input, Output> {
    name: string;
    handler: UseCaseHandler<Input, Output>;
}

export type UsecaseDescriptor = Descriptor<
    DescriptorKind.usecase,
    UseCaseDescriptorData<any, any>
>;
