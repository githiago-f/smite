import type { Descriptor, DescriptorKind } from "@core/descriptor";
import type {
    APIGatewayProxyEvent,
    APIGatewayProxyEventV2,
    Handler,
} from "aws-lambda";
import type { z } from "zod/v4-mini";

export type RequestType = Partial<
    Record<keyof APIGatewayProxyEvent, z.ZodMiniType>
>;

export interface RequestContext {
    requestId: string;
    rawToken: string | undefined;
}

export type HttpMethod = "POST" | "GET" | "PUT" | "PATCH" | "*";

type SafeInput<I extends RequestType> = { [K in keyof I]: z.infer<I[K]> };

export interface RouteDescriptorData<I extends RequestType, O = any> {
    path: string;
    request: I;
    method: HttpMethod | Lowercase<HttpMethod>;
    handler: (safeInput: SafeInput<I>) => Promise<O>;
}

export type RouteDescriptor<I extends RequestType = any, O = any> = Descriptor<
    DescriptorKind.route,
    RouteDescriptorData<I, O> & {
        eventHandler: Handler<APIGatewayProxyEvent | APIGatewayProxyEventV2>;
    }
>;

export type InputData<I> = {
    [K in keyof I]: z.infer<I[K]>;
};
