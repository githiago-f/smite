import { defineDescriptor, DescriptorKind } from "@core/descriptor";
import type { Handler } from "aws-lambda";
import type { GuardDescriptor } from "../guard";
import type {
    ApplicationLevelService,
    ModuleBuilder,
    ModuleDescriptorData,
} from "./types";

function makeHandler(descriptor: ModuleDescriptorData) {
    return async (...args: Parameters<Handler>) => {
        let event = args[0],
            ctx = args[1],
            cb = args[2];
        for (const guard of descriptor.guards) {
            ({ event, awsContext: ctx } = await guard.data.handler(event, ctx));
        }

        const defaultHandler = (...args: Parameters<Handler>) => {
            throw new Error("Handler not defined for event", args[0]);
        };

        const descriptorKind = descriptor.handlerType ?? DescriptorKind.handler;
        const descriptorData = descriptor[descriptorKind]?.data;

        const handler = descriptorData?.eventHandler ?? defaultHandler;

        return handler(event, ctx, cb);
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
    let descriptor: ModuleDescriptorData = {
        name,
        guards: [],
        components: [],
    };

    let hasHandlerDefined = false;

    return {
        with(component) {
            const kind = component.__kind;

            switch (kind) {
                case DescriptorKind.guard:
                    descriptor.guards.push(component as GuardDescriptor);
                    break;
                case DescriptorKind.route:
                case DescriptorKind.handler:
                case DescriptorKind.controller:
                    descriptor =
                        setApplicationLevelServices<ApplicationLevelService>(
                            hasHandlerDefined,
                            descriptor,
                            component as ApplicationLevelService,
                        );
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
function setApplicationLevelServices<C extends ApplicationLevelService>(
    hasHandlerDefined: boolean,
    descriptor: ModuleDescriptorData,
    component: C,
) {
    if (hasHandlerDefined) {
        throw new Error("Module already has a main handler");
    }
    return {
        ...descriptor,
        handlerType: component.__kind,
        [component.__kind]: component,
    };
}
