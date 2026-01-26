import type { Descriptor, DescriptorKind } from "@core/descriptor";
import type { APIGatewayUnion } from "@core/helpers/handler-type";
import type { RouteDescriptor } from "@factories/route/type";
import type { Handler } from "aws-lambda";

export interface ControllerDescriptorData {
    name: string;
    routes: RouteDescriptor[];
}

export type ControllerDescriptor = Descriptor<
    DescriptorKind.controller,
    ControllerDescriptorData & {
        apiHandler: Handler<APIGatewayUnion>;
    }
>;

export interface ControllerBuilder {
    with<T>(route: Descriptor<DescriptorKind.route, T>): ControllerBuilder;
    build(): ControllerDescriptor;
}
