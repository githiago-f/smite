import { defineDescriptor, DescriptorKind } from "@core/descriptor";
import type z from "zod/v4-mini";
import type { APIGatewayProxyEvent, Context } from "aws-lambda";
import { safeParseJson } from "@core/parsers/safe-parse-json";
import { makeContext } from "@core/context";

type Handler<O> = (event: APIGatewayProxyEvent, ctx: Context) => Promise<O>;
type RequestT = Partial<Record<keyof APIGatewayProxyEvent, z.ZodMiniType>>;

export interface RequestContext {
    requestId: string;
}

export type RouteContextMapper = <R extends RequestContext>(
    event: APIGatewayProxyEvent,
    context: Context,
) => Promise<R>;

export type HttpMethod = "POST" | "GET" | "PUT" | "PATCH" | "*";

export interface HttpRoute<Request extends RequestT> {
    path: string;
    method: HttpMethod;
    request: Request;
}

export interface RouteDescriptorData<I extends RequestT, O = any> {
    route: HttpRoute<I>;
    mapContext?: RouteContextMapper;
    handler: (safeInput: {
        [K in keyof HttpRoute<I>["request"]]: z.infer<
            HttpRoute<I>["request"][K]
        >;
    }) => Promise<O>;
}

const { context, withContext } = makeContext<RequestContext>("RequestStore");

export function getRequestContext() {
    const store = context.getStore();

    if (store === undefined) {
        throw new Error(
            "Invalid request scope, this context is only available after guards are processed",
        );
    }

    return store;
}

function defaultMapContext<R>(event: APIGatewayProxyEvent, ctx: Context) {
    return {
        requestId: ctx.awsRequestId,
        rawToken: event.headers["Authorization"]?.replace("Bearer ", ""),
    } as R;
}

const makeHandler =
    <I extends RequestT, O>(desc: RouteDescriptorData<I, O>): Handler<O> =>
    async (event, ctx) => {
        const mapContext = desc.mapContext ?? defaultMapContext;

        return withContext(await mapContext(event, ctx), () => {
            const request = desc.route.request;
            const keys = Object.keys(request as object);
            type InputData = { [K in keyof I]: z.infer<I[K]> };

            const data = keys.reduce(
                (acc, k) => ({
                    ...acc,
                    [k]: safeParseKeys(k, event, request),
                }),
                {} as InputData,
            );

            return desc.handler(data);
        });
    };

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

/**
 * API port descriptor -> describes how a specific
 * route should be handled by the inner system
 */
export function defineRoute<I extends RequestT>(d: RouteDescriptorData<I>) {
    const key = `${d.route.method} ${d.route.path}`;
    const descriptorWithHandler = {
        ...d,
        apiHandler: makeHandler(d),
    };

    return defineDescriptor(DescriptorKind.route, key, descriptorWithHandler);
}
