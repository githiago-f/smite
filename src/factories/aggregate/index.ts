import { defineDescriptor, DescriptorKind } from "@core/descriptor";
import { AggregateValidationError } from "../errors/aggregate-validation-error";
import type {
    AggregateDescriptor,
    AggregateDescriptorInput,
    AggregateFactory,
    EventU,
} from "./type";

function applyAll<State, Events>(
    descriptor: AggregateDescriptorInput<State, Events>,
    currentState: State,
    events: EventU<Events>[],
) {
    let newState = currentState;
    for (const event of events) {
        const applier = descriptor.effectAppliers[event.kind];
        const parser = descriptor.events[event.kind];
        if (applier !== undefined) {
            const parsedEvent = parser.safeParse(event.data);
            if (!parsedEvent.success) {
                throw new AggregateValidationError(parsedEvent.error, event);
            }

            const parsedState = descriptor.state.safeParse(
                applier(newState, parsedEvent.data),
            );
            if (!parsedState.success) {
                throw new AggregateValidationError(parsedState.error, event);
            }

            newState = parsedState.data;
        }
    }

    return newState;
}

function commitAction<S, E>(data: S, factory: AggregateFactory<S, E>) {
    return () => factory(data, []);
}

function putEventAction<S, E>(
    descriptor: AggregateDescriptorInput<S, E>,
    data: S,
    events: EventU<E>[],
    factory: AggregateFactory<S, E>,
) {
    return <K extends keyof E>(event: { data: E[K]; kind: K }) => {
        const merged = events.concat([event]);
        const newState = applyAll(descriptor, data, [event]);
        return factory(newState, merged);
    };
}

function foldAction<S>(initialData: S) {
    return <R>(fn: (s: S) => R) => fn(initialData);
}

function makeAggregateFactory<State, Events>(
    descriptor: AggregateDescriptorInput<State, Events>,
) {
    type AF = AggregateFactory<State, Events>;
    const aggregateFactory: AF = (initialData, events = []) => {
        const safeState = descriptor.state.safeParse(initialData);
        if (!safeState.success) {
            throw new AggregateValidationError(safeState.error, undefined);
        }

        return {
            state: safeState.data,
            fold: foldAction(safeState.data),
            putEvent: putEventAction(
                descriptor,
                safeState.data,
                events,
                aggregateFactory,
            ),
            commit: commitAction(safeState.data, aggregateFactory),
        };
    };

    return aggregateFactory;
}

export function defineAggregate<State, Events>(
    descriptor: AggregateDescriptorInput<State, Events>,
): AggregateDescriptor<State, Events> {
    return defineDescriptor(DescriptorKind.aggregate, descriptor.name, {
        ...descriptor,
        factory: makeAggregateFactory(descriptor),
    });
}
