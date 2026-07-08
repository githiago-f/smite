import type {
  HttpControllerDescriptor,
  HttpRouteDescriptor,
  LifecycleCompositionDescriptor,
  LifecycleEntry,
  LifecycleEntryKind,
} from "@smitejs/core";

export type ExpressDependencyKey = string;

export type ExpressDependencyValue = CallableFunction;

export interface ExpressRuntimeModule {
  readonly source: string;
  readonly dependencies: readonly ExpressDependencyKey[];
}

export interface ExpressRuntimeModuleOptions {
  readonly appIdentifier?: string;
  readonly handlerIdentifier?: string;
}

export type ExpressLifecycleEntryKind = LifecycleEntryKind;

export type ExpressLifecycleEntry = LifecycleEntry;

export type ExpressLifecycleComposition = LifecycleCompositionDescriptor;

export type ExpressControllerDescriptor = HttpControllerDescriptor;

export type ExpressRouteDescriptor = HttpRouteDescriptor;
