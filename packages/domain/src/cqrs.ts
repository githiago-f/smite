import { usecase } from "./usecase.js";
import type { Usecase, UsecaseConfig } from "./usecase.js";

type CommandConfig<Deps, Input, Output, ErrorValue> = Omit<
  UsecaseConfig<Deps, Input, Output, ErrorValue>,
  "kind"
>;

/**
 * Builds a mutating usecase (CQRS command). Same kernel as {@link usecase};
 * only the recorded `kind` differs.
 *
 * @group Builders
 * @example Define a usecase
 */
export const command = <Deps, Input, Output, ErrorValue = unknown>(
  config: CommandConfig<Deps, Input, Output, ErrorValue>,
): Usecase<Deps, Input, Output, ErrorValue> =>
  usecase({ ...config, kind: "command" });

/**
 * Builds a read-only usecase (CQRS query). Same kernel as {@link usecase}; only
 * the recorded `kind` differs.
 *
 * @group Builders
 * @example Define a usecase
 */
export const query = <Deps, Input, Output, ErrorValue = unknown>(
  config: CommandConfig<Deps, Input, Output, ErrorValue>,
): Usecase<Deps, Input, Output, ErrorValue> =>
  usecase({ ...config, kind: "query" });
