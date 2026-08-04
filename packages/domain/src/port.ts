import { defineDescriptor } from "@smitejs/core";
import type { Descriptor } from "@smitejs/core";
import type { Result } from "@smitejs/fp";

/**
 * A `domain.port` IR node naming a dependency contract.
 *
 * @group Internals
 */
export interface PortDescriptor
  extends Descriptor<
    "domain.port",
    { readonly name: string; readonly methods: readonly string[] }
  > {}

/**
 * A write/read repository contract. Any object with these members satisfies it
 * structurally, so production stores swap in without touching the usecase.
 *
 * @group Types
 */
export type Repository<Value, Id> = {
  readonly findById: (id: Id) => PromiseLike<Result<Value | null, unknown>>;
  readonly save: (value: Value) => PromiseLike<Result<void, unknown>>;
};

/**
 * The read half of a repository: depends only on reads.
 *
 * @group Types
 */
export type ReadPort<Value, Id> = Pick<Repository<Value, Id>, "findById">;

/**
 * The write half of a repository: depends only on writes.
 *
 * @group Types
 */
export type WritePort<Value, Id> = Pick<Repository<Value, Id>, "save">;

/**
 * Records a port (a dependency contract) so the collect-mode CLI can graph
 * what each usecase depends on. The contract itself is a plain TypeScript type
 * the usecase declares; this builder only registers the IR node.
 *
 * @group Builders
 * @example Declare a repository port
 */
export function port(config: {
  readonly name: string;
  readonly methods: readonly string[];
}): PortDescriptor {
  return defineDescriptor("domain.port", config.name, {
    name: config.name,
    methods: config.methods,
  });
}
