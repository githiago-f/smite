import { defineDescriptor, DescriptorKind } from "@core/descriptor";
import { extractHttpInfo } from "@core/helpers/api-gateway";
import type { HandlerParams } from "@core/helpers/handler-type";
import { createRouteMatcher } from "@core/helpers/router";
import { NotFoundError } from "@factories/errors/not-found";
import type { RouteDescriptor } from "@factories/route/type";
import type { ControllerDescriptorData, ControllerBuilder } from "./type";

function makeHandler(descriptor: ControllerDescriptorData) {
    const matchers = descriptor.routes.map((route) => {
        const matcher = createRouteMatcher(route.data.path);
        return { route, matcher };
    });

    return async (...args: HandlerParams) => {
        const { path, httpMethod } = extractHttpInfo(args[0]);

        for (const { route, matcher } of matchers) {
            const match = matcher(path);
            const matchMethod = route.data.method === "*"
                || route.data.method.toUpperCase() === httpMethod.toUpperCase();
            if (matchMethod || match.matched) {
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
