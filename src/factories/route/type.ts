import type { Descriptor, DescriptorKind } from "@core/descriptor";
import type { APIGatewayUnion } from "@core/helpers/handler-type";
import type { Handler } from "aws-lambda";
import type { z } from "zod/v4";

export type RequestType = Partial<Record<keyof APIGatewayUnion, z.ZodType>>;

export interface RequestContext {
    requestId: string;
    rawToken: string | undefined;
}

export type HttpMethod = "POST" | "GET" | "PUT" | "PATCH" | "*";

type SafeInput<I extends RequestType> = { [K in keyof I]: z.infer<I[K]> };

export interface RouteDescriptorData<I extends RequestType, O = any> {
    /**
     * @default '/'
     **/
    path?: string;
    /**
     * @default '*'
     */
    method?: HttpMethod | Lowercase<HttpMethod>;
    description?: string;
    summary?: string;
    tags?: string[];
    request?: I;
    handler: (safeInput: SafeInput<I>) => Promise<O>;
}

export type RouteDescriptor<I extends RequestType = any, O = any> = Descriptor<
    DescriptorKind.route,
    RouteDescriptorData<I, O> & {
        eventHandler: Handler<APIGatewayUnion>;
    }
>;

export type InputData<I> = {
    [K in keyof I]: z.infer<I[K]>;
};
