import { defineDescriptor, DescriptorKind } from "@core/descriptor";
import { AggregateValidationError } from "../errors/aggregate-validation-error";
import type {
    AggregateDescriptor,
    AggregateDescriptorInput,
    AggregateFactory,
    EffectApplierU,
    EventParserU,
    EventU,
} from "./type";
import type z from "zod/v4-mini";

function applyAll<State, Events>(
    descriptor: AggregateDescriptorInput<State, Events>,
    currentState: State,
    events: EventU<Events>[],
) {
    let newState = currentState;
    for (const event of events) {
        const applier = descriptor.effectAppliers[event.kind];
        const parser = descriptor.events[event.kind];
        if (applier === undefined) continue;

        const parsedEvent = parseEvent<Events>(parser, event);

        const parsedState = parseState<State, Events>(
            descriptor,
            applier,
            newState,
            parsedEvent,
            event,
        );

        newState = parsedState;
    }

    return newState;
}

function parseState<State, Events>(
    descriptor: AggregateDescriptorInput<State, Events>,
    applier: EffectApplierU<Events, State>,
    newState: State,
    parsedEvent: z.infer<EventParserU<Events>>,
    event: EventU<Events>,
) {
    const parsedState = descriptor.state.safeParse(
        applier(newState, parsedEvent),
    );
    if (!parsedState.success) {
        throw new AggregateValidationError(parsedState.error, event);
    }
    return parsedState.data;
}

function parseEvent<Events>(
    parser: EventParserU<Events>,
    event: EventU<Events>,
) {
    const parsedEvent = parser.safeParse(event.data);
    if (!parsedEvent.success) {
        throw new AggregateValidationError(parsedEvent.error, event);
    }
    return parsedEvent.data;
}

export function defineAggregate<State, Events>(
    descriptor: AggregateDescriptorInput<State, Events>,
): AggregateDescriptor<State, Events> {
    const aggregateFactory: AggregateFactory<State, Events> = (
        initialData,
        events = [],
    ) => {
        const safeState = descriptor.state.safeParse(initialData);
        if (!safeState.success) {
            throw new AggregateValidationError(safeState.error, undefined);
        }

        return {
            state: safeState.data,
            fold: (fn) => fn(safeState.data),
            putEvent: (event) => {
                const merged = events.concat([event]);
                const newState = applyAll(descriptor, safeState.data, [event]);
                return aggregateFactory(newState, merged);
            },
            commit: () => aggregateFactory(safeState.data, []),
        };
    };

    return defineDescriptor(DescriptorKind.aggregate, descriptor.name, {
        ...descriptor,
        factory: aggregateFactory,
    });
}
