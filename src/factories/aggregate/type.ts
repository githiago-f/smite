import type { Descriptor, DescriptorKind } from "@core/descriptor";
import type { ZodMiniType } from "zod/v4-mini";

export type Aggregate<State, Events> = {
    state: State;
    commit(): Aggregate<State, Events>;
    fold<R>(fn: (a: State) => R): R;
    putEvent<K extends keyof Events>(event: {
        kind: K;
        data: Events[K];
    }): Aggregate<State, Events>;
};

export interface AggregateDescriptorInput<State, Events> {
    name: string;
    state: ZodMiniType<State>;
    events: {
        [K in keyof Events]: ZodMiniType<Events[K]>;
    };
    effectAppliers: {
        [K in keyof Events]: (s: State, e: Events[K]) => State;
    };
}

export type EventU<EventT> = {
    [K in keyof EventT]: { kind: K; data: EventT[K] };
}[keyof EventT];

export type EffectApplierU<Events, State> = {
    [K in keyof Events]: (s: State, e: Events[K]) => State;
}[keyof Events];

export type EventParserU<Events> = {
    [K in keyof Events]: ZodMiniType<Events[K]>;
}[keyof Events];

export type AggregateFactory<S, E> = (d: S, e?: EventU<E>[]) => Aggregate<S, E>;

export type AggregateDescriptor<State, Events> = Descriptor<
    DescriptorKind.aggregate,
    AggregateDescriptorInput<State, Events> & {
        factory: AggregateFactory<State, Events>;
    }
>;
