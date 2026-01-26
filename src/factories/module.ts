import {
    defineDescriptor,
    type Descriptor,
    DescriptorKind,
} from "@core/descriptor";
import type { Handler } from "aws-lambda";
import { isApiGatewayEvent } from "@core/helpers/api-gateway";
import type { RouteDescriptor } from "./route/type";
import type { HandlerDescriptor } from "./handler";
import type { ControllerDescriptor } from "./controller/type";
import type { GuardDescriptor } from "./guard/type";

export type NonModuleDescriptorKind = Exclude<DescriptorKind, "module">;
type DefaultDescriptor = Descriptor<NonModuleDescriptorKind, unknown>;

export interface ModuleDescriptorData {
    name: string;
    eventHandler: Handler;
    handler?: HandlerDescriptor;
    guards: GuardDescriptor[];
    controller?: ControllerDescriptor;
    route?: RouteDescriptor;
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
        let event = args[0], ctx = args[1], cb = args[2];
        for (const guard of descriptor.guards) {
            ({ event, awsContext: ctx } = await guard.data.handler(event, ctx));
        }

        if (isApiGatewayEvent(event)) {
            if (descriptor.controller) {
                return descriptor.controller.data.apiHandler(
                    event,
                    ctx,
                    cb,
                );
            }

            if (descriptor.route) {
                return descriptor.route.data.apiHandler(
                    event,
                    ctx,
                    cb,
                );
            }
        }

        return descriptor.handler?.data.handler(...args) ?? (() => {
            throw new Error('Handler not defined for event', args[0]);
        });
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
        components: [],
        eventHandler: async () => { },
    };

    let hasHandlerDefined = false;

    return {
        with(component) {
            const kind = component.__kind;

            switch (kind) {
                case DescriptorKind.guard:
                    descriptor.guards.push(component as GuardDescriptor);
                    break;
                case DescriptorKind.controller:
                    if (hasHandlerDefined) { throw new Error('Module already has a main handler'); }
                    descriptor.controller ??= component as ControllerDescriptor;
                    hasHandlerDefined = true;
                    break;
                case DescriptorKind.route:
                    if (hasHandlerDefined) { throw new Error('Module already has a main handler'); }
                    descriptor.route ??= component as RouteDescriptor;
                    hasHandlerDefined = true;
                    break;
                case DescriptorKind.handler:
                    if (hasHandlerDefined) { throw new Error('Module already has a main handler'); }
                    descriptor.handler ??= component as HandlerDescriptor;
                    hasHandlerDefined = true;
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
