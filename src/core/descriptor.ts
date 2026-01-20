export enum DescriptorKind {
    aggregate = "aggregate",
    usecase = "usecase",
    controller = "controller",
    service = "service",
    handler = "handler",
}

export interface Descriptor<TKind extends DescriptorKind, TData> {
    __kind: TKind;
    __key: string;
    data: TData;
}

export function defineDescriptor<TKind extends DescriptorKind, TData>(
    kind: TKind,
    key: string,
    data: TData,
): Descriptor<TKind, TData> {
    return { __kind: kind, __key: key, data: data };
}
