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
        let event = args[0],
            context = args[1],
            callback = args[2];
        for (const guard of descriptor.guards) {
            ({ event, context } = await guard.data.handler(event, context));
        }

        if (isApiGatewayEvent(event)) {
            if (descriptor.controller) {
                return descriptor.controller.data.apiHandler(
                    event,
                    context,
                    callback,
                );
            }

            if (descriptor.route) {
                return descriptor.route.data.apiHandler(
                    event,
                    context,
                    callback,
                );
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
