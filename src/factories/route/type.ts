import type { Descriptor, DescriptorKind } from "@core/descriptor";
import type { APIGatewayProxyEvent, Handler } from "aws-lambda";
import type { z } from "zod/v4-mini";

export type RequestT = Partial<
    Record<keyof APIGatewayProxyEvent, z.ZodMiniType>
>;

export interface RequestContext {
    requestId: string;
    rawToken: string | undefined;
}

export type HttpMethod = "POST" | "GET" | "PUT" | "PATCH" | "*";

type SafeInput<I extends RequestT> = { [K in keyof I]: z.infer<I[K]> };

export interface RouteDescriptorData<I extends RequestT, O = any> {
    path: string;
    request: I;
    method: HttpMethod;
    mapContext?: Handler<APIGatewayProxyEvent>;
    handler: (safeInput: SafeInput<I>) => Promise<O>;
}

export type RouteDescriptor<I extends RequestT = any, O = any> = Descriptor<
    DescriptorKind.route,
    RouteDescriptorData<I, O> & { apiHandler: Handler<APIGatewayProxyEvent> }
>;
