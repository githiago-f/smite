import type { Descriptor, DescriptorKind } from "@core/descriptor";
import type { AggregateDescriptor } from "@factories/aggregate/type";
import type { ControllerDescriptor } from "@factories/controller/type";
import type { GuardDescriptor } from "@factories/guard";
import type { HandlerDescriptor } from "@factories/handler/type";
import type { RouteDescriptor } from "@factories/route/type";
import type { UsecaseDescriptor } from "@factories/usecase";
import type { Handler } from "aws-lambda/handler";

type Descriptors = {
    [DescriptorKind.controller]: ControllerDescriptor;
    [DescriptorKind.route]: RouteDescriptor;
    [DescriptorKind.handler]: HandlerDescriptor;
    [DescriptorKind.guard]: GuardDescriptor;
    [DescriptorKind.aggregate]: AggregateDescriptor<any, any>;
    [DescriptorKind.usecase]: UsecaseDescriptor;
    [DescriptorKind.service]: Descriptor<DescriptorKind.service, unknown>;
};

export type NonModuleDescriptorKind = Exclude<DescriptorKind, "module">;
export type DefaultDescriptor = Descriptors[NonModuleDescriptorKind];

export type ApplicationLevelService =
    | ControllerDescriptor
    | RouteDescriptor
    | HandlerDescriptor;

export interface ModuleRegistryData {
    name: string;

    handlerType?: ApplicationLevelService["__kind"];

    byKind: {
        [K in NonModuleDescriptorKind]: Descriptors[K][];
    };
}

export interface ModuleBuilder {
    with<T extends Descriptors[NonModuleDescriptorKind]>(
        component: T,
    ): ModuleBuilder;
    build(): ModuleDescriptor;
}

export type ModuleDescriptor = Descriptor<
    DescriptorKind.module,
    ModuleRegistryData & { eventHandler: Handler }
>;
