import { defineDescriptor, DescriptorKind } from "@core/descriptor";
import type z from "zod/v4";
import type {
    APIGatewayProxyEvent,
    APIGatewayProxyEventV2,
    Handler,
} from "aws-lambda";
import { safeParseJson } from "@core/parsers/safe-parse-json";
import type {
    InputData,
    RequestType,
    RouteDescriptor,
    RouteDescriptorData,
} from "./type";
import { context, defaultContextMapper, withContext } from "./context";
import { BadContextError } from "@factories/errors/bad-context-error";

export type { RouteDescriptor, RequestContext, HttpMethod } from "./type";

function makeHandler<I extends RequestType, O>(
    descriptor: RouteDescriptorData<I, O>,
): Handler<APIGatewayProxyEvent | APIGatewayProxyEventV2, O> {
    return async (event, ctx) =>
        withContext(
            await defaultContextMapper(event, ctx),
            makeContextHandler<I, O>(descriptor, event),
        );
}

function makeContextHandler<I extends RequestType, O>(
    descriptor: RouteDescriptorData<I, O>,
    event: APIGatewayProxyEvent | APIGatewayProxyEventV2,
) {
    return () => {
        const request = descriptor.request;
        const keys = Object.keys(request) as (keyof I)[];

        const data = {} as InputData<I>;
        for (const key of keys) {
            const fieldData =
                key === "body"
                    ? safeParseJson(event.body)
                    : event[key as keyof typeof event];

            const parser = request[key] as z.ZodType;
            data[key] = parseFieldData(parser, fieldData);
        }

        return descriptor.handler(data);
    };
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
