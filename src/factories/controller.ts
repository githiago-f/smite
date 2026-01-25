import {
    defineDescriptor,
    DescriptorKind,
    type Descriptor,
} from "@core/descriptor";
import type {
    APIGatewayProxyEvent,
    APIGatewayProxyEventV2,
    Handler,
} from "aws-lambda";
import { createRouteMatcher } from "../core/helpers/router";
import type { RouteDescriptor } from "./route/type";
import { NotFoundError } from "./errors/not-found";
import { isApiGatewayV1 } from "@core/helpers/api-gateway-checkers";

export interface ControllerDescriptorData {
    name: string;
    routes: RouteDescriptor[];
    apiHandler: Handler<APIGatewayProxyEvent | APIGatewayProxyEventV2>;
}

export type ControllerDescriptor = Descriptor<
    DescriptorKind.controller,
    ControllerDescriptorData
>;

export interface ControllerBuilder {
    with<T>(route: Descriptor<DescriptorKind.route, T>): ControllerBuilder;
    build(): ControllerDescriptor;
}

function makeHandler(descriptor: ControllerDescriptorData) {
    const matchers = descriptor.routes.map((route) => {
        const matcher = createRouteMatcher(route.data.path);
        return { route, matcher };
    });

    return async (
        ...args: Parameters<
            Handler<APIGatewayProxyEvent | APIGatewayProxyEventV2>
        >
    ) => {
        const { path, httpMethod } = isApiGatewayV1(args[0])
            ? { path: args[0].path, httpMethod: args[0].httpMethod }
            : {
                  path: args[0].rawPath,
                  httpMethod: args[0].requestContext.http.method,
              };

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
        with(route) {
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
