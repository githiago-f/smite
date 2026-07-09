import { freeze, freezeArray } from "../internal/freeze.js";
import { emptyLifecycleDescriptor } from "../lifecycle/merge.js";
import type {
  ApplicationDescriptor,
  DescriptorBuilder,
  HttpControllerDescriptor,
  MessagingConsumerDescriptor,
  SchedulerJobDescriptor,
} from "../types.js";

export type SmiteComponent =
  | DescriptorBuilder<HttpControllerDescriptor>
  | DescriptorBuilder<MessagingConsumerDescriptor>
  | DescriptorBuilder<SchedulerJobDescriptor>;

export interface ApplicationBuilder {
  readonly descriptor: ApplicationDescriptor;
  readonly add: (
    ...components: readonly SmiteComponent[]
  ) => ApplicationBuilder;
}

const createApplicationBuilder = (
  descriptor: ApplicationDescriptor,
): ApplicationBuilder =>
  freeze({
    descriptor,
    add: (...components) => {
      const controllers: HttpControllerDescriptor[] = [];
      const consumers: MessagingConsumerDescriptor[] = [];
      const jobs: SchedulerJobDescriptor[] = [];

      for (const component of components) {
        const d = component.descriptor;

        switch (d.kind) {
          case "http.controller": {
            controllers.push(d);
            break;
          }
          case "messaging.consumer": {
            consumers.push(d);
            break;
          }
          case "scheduler.job": {
            jobs.push(d);
            break;
          }
        }
      }

      return createApplicationBuilder(
        freeze({
          kind: "smite.application",
          controllers: freezeArray([...descriptor.controllers, ...controllers]),
          consumers: freezeArray([...descriptor.consumers, ...consumers]),
          jobs: freezeArray([...descriptor.jobs, ...jobs]),
        }),
      );
    },
  });

export const createApplication = (): ApplicationBuilder =>
  createApplicationBuilder(
    freeze({
      kind: "smite.application",
      controllers: freezeArray([]),
      consumers: freezeArray([]),
      jobs: freezeArray([]),
    }),
  );