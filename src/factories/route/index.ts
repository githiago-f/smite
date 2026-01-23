import { defineDescriptor, DescriptorKind } from "@core/descriptor";
import type z from "zod/v4-mini";
import type { APIGatewayProxyEvent, Handler } from "aws-lambda";
import { safeParseJson } from "@core/parsers/safe-parse-json";
import type { RequestT, RouteDescriptor, RouteDescriptorData } from "./type";
import { context, defaultContextMapper, withContext } from "./context";
import { BadContextError } from "@factories/errors/bad-context-error";

type InputData<I> = {
    [K in keyof I]: z.infer<I[K]>;
};

function makeHandler<I extends RequestT, O>(
    descriptor: RouteDescriptorData<I, O>,
): Handler<APIGatewayProxyEvent, O> {
    return async (event, ctx) => {
        const mapContext = descriptor.mapContext ?? defaultContextMapper;

        return withContext(
            await mapContext(event, ctx),
            makeContextHandler<I, O>(descriptor, event),
        );
    };
}

function makeContextHandler<I extends RequestT, O>(
    descriptor: RouteDescriptorData<I, O>,
    event: APIGatewayProxyEvent,
): () => Promise<O> {
    return () => {
        const request = descriptor.request;
        const keys = Object.keys(request as object);

        const data = keys.reduce(
            (acc, k) => ({
                ...acc,
                [k]: safeParseKeys(k, event, request),
            }),
            {} as InputData<I>,
        );

        return descriptor.handler(data);
    };
}

function safeParseKeys(
    key: string,
    event: APIGatewayProxyEvent,
    request: Record<string, z.ZodMiniType>,
) {
    const fieldData =
        key === "body"
            ? safeParseJson(event[key])
            : event[key as keyof APIGatewayProxyEvent];

    const safelyParsed = request?.[key]?.safeParse(fieldData);
    if (!safelyParsed?.success) {
        throw safelyParsed?.error ?? new Error("Parser not defined");
    }

    return safelyParsed.data;
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
export function defineRoute<I extends RequestT>(
    descriptor: RouteDescriptorData<I>,
): RouteDescriptor<I> {
    const key = `${descriptor.method} ${descriptor.path}`;
    const descriptorWithHandler = {
        ...descriptor,
        apiHandler: makeHandler(descriptor),
    };

    return defineDescriptor(DescriptorKind.route, key, descriptorWithHandler);
}
