import { defineDescriptor, DescriptorKind } from "@core/descriptor";
import type z from "zod/v4";
import type { Handler } from "aws-lambda";
import { safeParseJson } from "@core/parsers/safe-parse-json";
import type {
    InputData,
    RequestType,
    RouteDescriptor,
    RouteDescriptorData,
} from "./type";
import { context, withContext } from "./context";
import { BadContextError } from "@factories/errors/bad-context-error";
import type { APIGatewayUnion } from "@core/helpers/handler-type";

export type { RouteDescriptor } from "./type";

function makeHandler<I extends RequestType, O>(
    descriptor: RouteDescriptorData<I, O>,
): Handler<APIGatewayUnion, O> {
    return async (event, ctx) =>
        withContext({ rawToken: "", requestId: "" }, () => {
            const request = descriptor.request;
            const keys = Object.keys(request) as (keyof I)[];

            const data = safeParseInput(event, keys, request);

            return descriptor.handler(data);
        });
}

function safeParseInput<I extends RequestType>(
    event: APIGatewayUnion,
    keys: (keyof I)[],
    request: I,
): InputData<I> {
    const data = {} as InputData<I>;
    for (const key of keys) {
        const fieldData =
            key === "body"
                ? safeParseJson(event.body)
                : event[key as keyof typeof event];

        const parser = request[key] as z.ZodType;
        data[key] = parseFieldData(parser, fieldData);
    }
    return data;
}

function parseFieldData<T>(parser: z.ZodType, fieldData: unknown): T {
    const safelyParsed = parser.safeParse(fieldData);
    if (!safelyParsed?.success) {
        throw safelyParsed?.error ?? new Error("Parser not defined");
    }
    return safelyParsed.data as T;
}

export function getRequestContext() {
    const store = context.getStore();

    if (store === undefined) {
        throw new BadContextError();
    }

    return store;
}

/**
 * Defines a route descriptor with the given configuration.
 */
export function defineRoute<I extends RequestType>(
    descriptor: RouteDescriptorData<I>,
): RouteDescriptor<I> {
    const key = `${descriptor.method} ${descriptor.path}`;

    return defineDescriptor(DescriptorKind.route, key, {
        ...descriptor,
        eventHandler: makeHandler(descriptor),
    });
}
