import {
    defineDescriptor,
    type Descriptor,
    DescriptorKind,
} from "@core/descriptor";
import type { GuardDescriptor } from "./guard";
import type { Handler } from "aws-lambda";
import { isApiGatewayEvent } from "@core/helpers/api-gateway-checkers";
import type { ControllerDescriptor } from "./controller";
import type { RouteDescriptor } from "./route/type";
import type { HandlerDescriptor } from "./handler";

export type NonModuleDescriptorKind = Exclude<DescriptorKind, "module">;
type DefaultDescriptor = Descriptor<NonModuleDescriptorKind, unknown>;

export interface ModuleDescriptorData {
    name: string;
    eventHandler: Handler;
    handler: HandlerDescriptor;
    guards: GuardDescriptor[];
    controller: ControllerDescriptor;
    route: RouteDescriptor;
    components: DefaultDescriptor[];
}

export interface ModuleBuilder {
    with<
        T extends
            | DefaultDescriptor
            | GuardDescriptor
            | ControllerDescriptor
            | RouteDescriptor
            | HandlerDescriptor,
    >(
        component: T,
    ): ModuleBuilder;
    build(): Descriptor<DescriptorKind.module, ModuleDescriptorData>;
}

function makeHandler(descriptor: ModuleDescriptorData) {
    return async (...args: Parameters<Handler>) => {
        if (isApiGatewayEvent(args[0])) {
            if (descriptor.guards.length !== 0) {
                // apply guards
                for (const guard of descriptor.guards) {
                    await guard.data.handler(...args);
                }
            }

            if (descriptor.controller) {
                // further handling (controllers/routes) would go here
                return descriptor.controller.data.apiHandler(...args);
            }

            if (descriptor.route) {
                return descriptor.route.data.apiHandler(...args);
            }
        }

        return descriptor.handler.data.handler(...args);
    };
}

/**
 * Builds a module descriptor with the given name.
 *
 * @example
 * ```ts
 * moduleBuilder("MyModule")
 *  .with(defineGuard({ name: "MyGuard", handler: async () => {} }))
 *  .with(
 *    controllerBuilder("MyController")
 *      .use(myRouteDescriptor)
 *      .build(),
 *  )
 *  .build();
 * ```
 */
export function moduleBuilder(name: string): ModuleBuilder {
    const descriptor: ModuleDescriptorData = {
        name,
        guards: [],
        controller: undefined as unknown as ControllerDescriptor,
        handler: undefined as unknown as HandlerDescriptor,
        route: undefined as unknown as RouteDescriptor,
        components: [],
        eventHandler: async () => {},
    };

    return {
        with(component) {
            const kind = component.__kind;

            switch (kind) {
                case DescriptorKind.guard:
                    descriptor.guards.push(component as GuardDescriptor);
                    break;
                case DescriptorKind.controller:
                    descriptor.controller = component as ControllerDescriptor;
                    break;
                case DescriptorKind.route:
                    descriptor.route = component as RouteDescriptor;
                    break;
                case DescriptorKind.handler:
                    descriptor.handler = component as HandlerDescriptor;
                    break;
                default:
                    descriptor.components.push(component);
            }

            return this;
        },
        build() {
            return defineDescriptor(DescriptorKind.module, descriptor.name, {
                ...descriptor,
                eventHandler: makeHandler(descriptor),
            });
        },
    };
}
