import { defineDescriptor, DescriptorKind } from "@core/descriptor";
import type { Handler } from "aws-lambda";
import type {
    ModuleBuilder,
    ModuleRegistryData,
    NonModuleDescriptorKind,
} from "./type";

function makeHandler(descriptor: ModuleRegistryData) {
    return async (...[event, ctx, cb]: Parameters<Handler>) => {
        for (const guard of descriptor.byKind.guard) {
            ({ event, awsContext: ctx } = await guard.data.handler(event, ctx));
        }

        const defaultHandler = (...args: Parameters<Handler>) => {
            throw new Error("Handler not defined for event", args[0]);
        };

        const descriptorKind = descriptor.handlerType ?? DescriptorKind.handler;
        const descriptorData = descriptor.byKind[descriptorKind].at(0)?.data;

        const handler = descriptorData?.eventHandler ?? defaultHandler;

        return handler(event, ctx, cb);
    };
}

const isAppLevelService = (kind: NonModuleDescriptorKind) =>
    kind === DescriptorKind.controller ||
    kind === DescriptorKind.route ||
    kind === DescriptorKind.handler;

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
    let descriptor: ModuleRegistryData = {
        name,
        byKind: {
            aggregate: [],
            controller: [],
            route: [],
            handler: [],
            guard: [],
            service: [],
            usecase: [],
        },
    };

    return {
        with(component) {
            descriptor.byKind[component.__kind].push(component as any);

            if (isAppLevelService(component.__kind)) {
                descriptor.handlerType = component.__kind;
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
