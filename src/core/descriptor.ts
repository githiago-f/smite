export enum DescriptorKind {
    aggregate = "aggregate",
    usecase = "usecase",
    controller = "controller",
    route = "route",
    guard = "guard",
    service = "service",
    handler = "handler",
    module = "module",
}

export interface Descriptor<TKind extends DescriptorKind, TData> {
    __kind: TKind;
    __key: string;
    data: TData;
}

declare const ALLOW_GLOBAL_REGISTRY: boolean;
declare const globalRegistry: Map<string, Descriptor<DescriptorKind, any>>;

export function defineDescriptor<TKind extends DescriptorKind, TData>(
    kind: TKind,
    key: string,
    data: TData,
): Descriptor<TKind, TData> {
    const descriptor = { __kind: kind, __key: key, data };
    ALLOW_GLOBAL_REGISTRY && globalRegistry?.set(key, descriptor);
    return descriptor;
}
