import {
    defineDescriptor,
    DescriptorKind,
    type Descriptor,
} from "@core/descriptor";
import type { APIGatewayProxyEvent, Handler } from "aws-lambda";
import { createRouteMatcher } from "../helpers/router";
import type { RouteDescriptor } from "./route/type";
import { NotFoundError } from "./errors/not-found";

export interface ControllerDescriptorData {
    name: string;
    routes: RouteDescriptor[];
    apiHandler: Handler<APIGatewayProxyEvent>;
}

export type ControllerDescriptor = Descriptor<
    DescriptorKind.controller,
    ControllerDescriptorData
>;

export interface ControllerBuilder {
    use<T>(route: Descriptor<DescriptorKind.route, T>): ControllerBuilder;
    build(): ControllerDescriptor;
}

function makeHandler(descriptor: ControllerDescriptorData) {
    const matchers = descriptor.routes.map((route) => {
        const matcher = createRouteMatcher(route.data.path);
        return { route, matcher };
    });

    return async (...args: Parameters<Handler<APIGatewayProxyEvent>>) => {
        const { path, httpMethod } = args[0];
        for (const { route, matcher } of matchers) {
            const match = matcher(path);
            if (
                match.matched &&
                route.data.method === httpMethod.toUpperCase()
            ) {
                return route.data.apiHandler(...args);
            }
        }

        throw new NotFoundError();
    };
}

/**
 * Builds a controller descriptor with the given name.
 */
export function controllerBuilder(name: string): ControllerBuilder {
    const descriptor: ControllerDescriptorData = {
        name,
        routes: [],
        apiHandler: async () => {},
    };
    return {
        use(route) {
            descriptor.routes.push(route as RouteDescriptor);
            return this;
        },
        build() {
            return defineDescriptor(
                DescriptorKind.controller,
                descriptor.name,
                { ...descriptor, apiHandler: makeHandler(descriptor) },
            );
        },
    };
}
