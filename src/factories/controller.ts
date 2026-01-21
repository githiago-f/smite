import { defineDescriptor, DescriptorKind } from "@core/descriptor";
import { withContext, type HttpApplicationContext } from "@core/context";
import { randomUUID } from "node:crypto";
import type { ZodMiniType } from "zod/v4-mini";

export interface HttpRoute<I, O> {
    path: string;
    method: "POST" | "GET" | "PUT" | "PATCH" | "*";
    request: ZodMiniType<I>;
}

export interface ControllerDescriptorData<I, O> {
    name: string;
    auth?: "user";
    route: HttpRoute<I, O>;
}

function makeApiHandler<I, O>(descriptor: ControllerDescriptorData<I, O>) {
    return (event: any, ctx: any) => {
        return withContext<HttpApplicationContext<{ email: string }>, any>(
            {
                requestId: randomUUID(),
                user: {
                    email:
                        String(Math.floor(Math.random() * 1000)) + "@email.com",
                },
            },
            async () => {
                // TODO implement this and consume a transformed interface
            },
        );
    };
}

export function defineController<I, O>(
    descriptor: ControllerDescriptorData<I, O>,
) {
    return defineDescriptor(DescriptorKind.controller, descriptor.name, {
        ...descriptor,
        apiHandler: makeApiHandler(descriptor),
    });
}
