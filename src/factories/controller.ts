import {
    defineDescriptor,
    DescriptorKind,
    type Descriptor,
} from "@core/descriptor";
import { type UseCaseDescriptorData } from "./usecase";
import { withContext } from "@core/context";
import { randomUUID } from "node:crypto";

export interface ControllerDescriptorData<I, O> {
    name: string;
    route: { path: string; method: "POST" | "GET" | "PUT" | "PATCH" };
    auth?: "user";
    useCase: Descriptor<DescriptorKind.usecase, UseCaseDescriptorData<I, O>>;
}

const extractUser = (_: any) => ({
    email: String(Math.floor(Math.random() * 1000)) + "@email.com",
    name: "T",
});

export function defineController<I, O>(
    descriptor: ControllerDescriptorData<I, O>,
) {
    const apiHandler = (event: any, ctx: any) =>
        withContext({ requestId: randomUUID(), user: extractUser(event) }, () =>
            descriptor.useCase.data.execute(event),
        );

    return defineDescriptor(DescriptorKind.controller, descriptor.name, {
        ...descriptor,
        apiHandler,
    });
}
