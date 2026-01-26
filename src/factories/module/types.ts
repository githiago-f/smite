import type { Descriptor, DescriptorKind } from "@core/descriptor";
import type { ControllerDescriptor } from "@factories/controller/type";
import type { GuardDescriptor } from "@factories/guard/type";
import type { HandlerDescriptor } from "@factories/handler/types";
import type { RouteDescriptor } from "@factories/route/type";
import type { Handler } from "aws-lambda/handler";

export type NonModuleDescriptorKind = Exclude<DescriptorKind, "module">;
export type DefaultDescriptor = Descriptor<NonModuleDescriptorKind, unknown>;

export type ApplicationLevelService =
    | ControllerDescriptor
    | RouteDescriptor
    | HandlerDescriptor;

export interface ModuleDescriptorData {
    name: string;
    handlerType?: ApplicationLevelService["__kind"];
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
    build(): ModuleDescriptor;
}

export type ModuleDescriptor = Descriptor<
    DescriptorKind.module,
    ModuleDescriptorData & { eventHandler: Handler }
>;
