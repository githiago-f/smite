import { defineDescriptor, relate } from "@smite/core";
import type { Descriptor, RelationshipDescriptor } from "@smite/core";
import type { Commit } from "./aggregate.js";
import { aggregateDescriptorSymbol } from "./aggregate.js";

/**
 * A `domain.projection` IR node.
 *
 * @group Internals
 */
export interface ProjectionDescriptor<_State, _Event, _ReadModel>
  extends Descriptor<
    "domain.projection",
    {
      readonly name: string;
      readonly aggregate: string;
      readonly reduceArity: number;
    }
  > {}

/**
 * Config for {@link projection}.
 *
 * @group Types
 */
export interface ProjectionConfig<State, Event, ReadModel> {
  readonly name: string;
  readonly aggregate: {
    readonly name: string;
    readonly [aggregateDescriptorSymbol]?:
      | {
          readonly __key: string;
        }
      | undefined;
  };
  readonly initial: () => ReadModel;
  readonly reduce: (
    readModel: ReadModel,
    projection: Commit<State, Event>,
  ) => ReadModel;
}

/**
 * A named read model derived from the committed projections of an aggregate.
 * `build(commits)` folds each {@link Commit} through `reduce`, producing a
 * queryable persistent representation that stays in sync with the event log.
 *
 * @group Types
 */
export interface Projection<State, Event, ReadModel> {
  readonly name: string;
  readonly build: (commits: readonly Commit<State, Event>[]) => ReadModel;
}

/**
 * Builds a read-side projection: a pure reducer over the committed events of an
 * aggregate (`domain.projection` node). `reduce(view, commit)` returns the next
 * read model; `build(commits)` folds a batch of commits into one. In collect
 * mode the projection is related to its aggregate edge so the CLI can trace
 * `projection → aggregate → events`.
 *
 * @group Builders
 * @example Build a read-side projection
 */
export function projection<State, Event, ReadModel>(config: {
  readonly name: string;
  readonly aggregate: ProjectionConfig<State, Event, ReadModel>["aggregate"];
  readonly initial: () => ReadModel;
  readonly reduce: (
    readModel: ReadModel,
    projection: Commit<State, Event>,
  ) => ReadModel;
}): Projection<State, Event, ReadModel> {
  const node = defineDescriptor("domain.projection", config.name, {
    name: config.name,
    aggregate: config.aggregate.name,
    reduceArity: config.reduce.length,
  });
  const aggregateNode = config.aggregate[aggregateDescriptorSymbol];
  if (aggregateNode !== undefined) {
    relate(
      node,
      "domain.aggregate",
      aggregateNode as Parameters<typeof relate>[2],
    );
  }

  return Object.freeze({
    name: config.name,
    build: (commits: readonly Commit<State, Event>[]): ReadModel =>
      commits.reduce<ReadModel>(
        (view, commit) => config.reduce(view, commit),
        config.initial(),
      ),
  });
}
export type { RelationshipDescriptor as ProjectionRelationship };
