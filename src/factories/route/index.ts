import { defineDescriptor, DescriptorKind } from "@core/descriptor";
import type z from "zod/v4-mini";
import type { APIGatewayProxyEvent, Handler } from "aws-lambda";
import { safeParseJson } from "@core/parsers/safe-parse-json";
import type {
    InputData,
    RequestType,
    RouteDescriptor,
    RouteDescriptorData,
} from "./type";
import { context, defaultContextMapper, withContext } from "./context";
import { BadContextError } from "@factories/errors/bad-context-error";

function makeHandler<I extends RequestType, O>(
    descriptor: RouteDescriptorData<I, O>,
): Handler<APIGatewayProxyEvent, O> {
    return async (event, ctx) => {
        const mapContext = descriptor.mapContext ?? defaultContextMapper;

        return withContext(
            await mapContext(event, ctx, () => {}),
            makeContextHandler<I, O>(descriptor, event),
        );
    };
}

function makeContextHandler<I extends RequestType, O>(
    descriptor: RouteDescriptorData<I, O>,
    event: APIGatewayProxyEvent,
) {
    return () => {
        const request = descriptor.request;
        const keys = Object.keys(request) as (keyof I)[];

        const data = {} as InputData<I>;
        for (const key of keys) {
            const parser = request[key] as z.ZodMiniType;

            const fieldData =
                key === "body"
                    ? safeParseJson(event.body)
                    : event[key as keyof APIGatewayProxyEvent];

            const safelyParsed = parser.safeParse(fieldData);
            if (!safelyParsed?.success) {
                throw safelyParsed?.error ?? new Error("Parser not defined");
            }

            data[key] = safelyParsed.data as InputData<I>[typeof key];
        }

        return descriptor.handler(data);
    };
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
    const descriptorWithHandler = {
        ...descriptor,
        apiHandler: makeHandler(descriptor),
    };

    return defineDescriptor(DescriptorKind.route, key, descriptorWithHandler);
}
