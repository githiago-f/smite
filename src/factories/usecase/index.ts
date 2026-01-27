import { defineDescriptor, DescriptorKind } from "@core/descriptor";
import type { UseCaseDescriptorData } from "./type";

export type { UsecaseDescriptor } from "./type";

/**
 * Defines a use case descriptor with the given data.
 *
 * @example
 * ```ts
 * const myUseCase = defineUseCase<{ id: string }, { name: string }>({
 *  name: "GetUserUseCase",
 *  async handler(input) {
 *    return { name: "User " + input.id };
 *  }
 * });
 * ```
 */
export function defineUseCase<I, O>(descriptor: UseCaseDescriptorData<I, O>) {
    return defineDescriptor(
        DescriptorKind.usecase,
        descriptor.name,
        descriptor,
    );
}
