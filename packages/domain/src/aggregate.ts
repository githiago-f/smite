import { defineDescriptor } from "@smitejs/core";
import type { Descriptor } from "@smitejs/core";
import { Result } from "@smitejs/fp";
import type { z } from "zod";
import type { DomainValidationError } from "./value-object.js";
import { freezeDeep } from "./value.js";

/**
 * A `domain.aggregate` IR node.
 *
 * @group Internals
 */
export interface AggregateDescriptor<Event>
  extends Descriptor<
    "domain.aggregate",
    {
      readonly name: string;
      readonly idKey: string;
      readonly eventSchema?: z.ZodType<Event>;
      readonly reduceArity: number;
    }
  > {}

/**
 * Non-enumerable symbol under which an aggregate factory stores its IR node,
 * read by {@link projection} to relate a projection to its aggregate edge.
 *
 * @group Internals
 */
export const aggregateDescriptorSymbol: unique symbol = Symbol.for(
  "@smitejs/domain/aggregateDescriptor",
);

/**
 * A single event in an aggregate's history, discriminated by `type`.
 *
 * @group Types
 */
export type AggregateEvent<Type extends string> = { readonly type: Type };

/**
 * The persistent representation folded from an aggregate's committed events.
 *
 * @group Types
 */
export interface Commit<State, Event> {
  readonly projection: Readonly<State>;
  readonly version: number;
  readonly events: readonly Event[];
}

/**
 * An event-sourced aggregate: a named reducer over an immutable event log. Each
 * instance receives and stores every event; `commit` folds the committed ones
 * into a persistent {@link Commit} projection.
 *
 * @group Types
 */
export interface Aggregate<State, Event, Id> {
  readonly name: string;
  readonly create: (id: Id) => AggregateInstance<State, Event, Id>;
  readonly load: (
    id: Id,
    events: readonly Event[],
  ) => AggregateInstance<State, Event, Id>;
  readonly [aggregateDescriptorSymbol]?: AggregateDescriptor<Event>;
}

/**
 * A materialized aggregate: the folded state plus the full event log it was
 * folded from. Immutable read-only; every operation returns a new instance.
 *
 * @group Types
 */
export interface AggregateInstance<State, Event, Id> {
  readonly id: Id;
  readonly state: Readonly<State>;
  readonly events: readonly Event[];
  readonly uncommitted: readonly Event[];
  readonly record: (
    event: Event,
  ) => Result<AggregateInstance<State, Event, Id>, DomainValidationError>;
  readonly commit: () => Commit<State, Event>;
}

/**
 * Builds an event-sourced aggregate from a reducer. `apply(state, event)`
 * returns the next state, keeping the log append-only. `create(id)` starts an
 * empty instance; `load(id, events)` replays a committed history. New instances
 * receive every event via `record` (validated by `eventSchema` when given) and
 * fold it into their `state`. `commit` produces the persistent projection of
 * the committed events. In collect mode a `domain.aggregate` node is
 * registered.
 *
 * @group Builders
 * @example Record an event on an aggregate
 * @example Replay a history into an aggregate
 * @example Commit an aggregate projection
 */
export function aggregate<State, Event, Id>(config: {
  readonly name: string;
  readonly idKey?: keyof State & string;
  readonly eventSchema?: z.ZodType<Event>;
  readonly initial: (id: Id) => State;
  readonly apply: (state: State, event: Event) => State;
}): Aggregate<State, Event, Id> {
  const descriptor = defineDescriptor("domain.aggregate", config.name, {
    name: config.name,
    idKey: config.idKey ?? "id",
    eventSchema: config.eventSchema,
    reduceArity: config.apply.length,
  });

  const fold = (state: State, events: readonly Event[]): State =>
    events.reduce<State>(config.apply, state);

  const instance = (
    id: Id,
    state: State,
    events: readonly Event[],
    uncommitted: readonly Event[],
  ): AggregateInstance<State, Event, Id> =>
    Object.freeze({
      id,
      state: freezeDeep(state),
      events: Object.freeze([...events]),
      uncommitted: Object.freeze([...uncommitted]),
      record: (event: Event) => {
        if (config.eventSchema !== undefined) {
          const parsed = config.eventSchema.safeParse(event);
          if (!parsed.success) {
            return Result.err<DomainValidationError>({
              tag: "domain.validation",
              data: parsed.error.issues,
            });
          }
          const next = parsed.data as Event;
          return Result.ok(
            instance(
              id,
              config.apply(state, next),
              [...events, next],
              [...uncommitted, next],
            ),
          );
        }
        return Result.ok(
          instance(
            id,
            config.apply(state, event),
            [...events, event],
            [...uncommitted, event],
          ),
        );
      },
      commit: (): Commit<State, Event> => ({
        projection: state,
        version: events.length,
        events: Object.freeze([...uncommitted]),
      }),
    });

  const asAggregate: Aggregate<State, Event, Id> = {
    name: config.name,
    create: (id) => instance(id, config.initial(id), [], []),
    load: (id, events) =>
      instance(id, fold(config.initial(id), events), events, []),
  };
  Object.defineProperty(asAggregate, aggregateDescriptorSymbol, {
    configurable: false,
    enumerable: false,
    value: descriptor,
  });
  return asAggregate;
}
