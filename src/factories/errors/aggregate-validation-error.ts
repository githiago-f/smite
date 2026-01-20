import type { $ZodError } from "zod/v4/core";

export class AggregateValidationError<T, E> extends Error {
    constructor(
        public readonly zodError: $ZodError<T>,
        public readonly event: E,
    ) {
        super("Failed to parse", { cause: zodError.cause });
    }
}
