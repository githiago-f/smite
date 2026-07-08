import { freeze } from "../internal/freeze.js";
import {
  emptyLifecycleDescriptor,
  mergeLifecycleDescriptors,
} from "../lifecycle/merge.js";
import type {
  HandlerReference,
  LifecycleSource,
  SchedulerJobDescriptor,
} from "../types.js";

/**
 * Immutable builder for a scheduled job descriptor.
 *
 * @group Scheduler
 * @intent Captures cron expression, handler reference and reusable lifecycle policy.
 * @example Scheduled job with lifecycle
 */
export interface SchedulerJobBuilder {
  readonly descriptor: SchedulerJobDescriptor;
  readonly use: (...sources: readonly LifecycleSource[]) => SchedulerJobBuilder;
  readonly cron: (cron: string) => SchedulerJobBuilder;
  readonly handler: (handler: HandlerReference) => SchedulerJobBuilder;
}

const createJobBuilder = (
  descriptor: SchedulerJobDescriptor,
): SchedulerJobBuilder =>
  freeze({
    descriptor,
    use: (...sources) =>
      createJobBuilder({
        ...descriptor,
        lifecycle: mergeLifecycleDescriptors(descriptor.lifecycle, ...sources),
      }),
    cron: (cron) =>
      createJobBuilder({
        ...descriptor,
        cron,
      }),
    handler: (handler) =>
      createJobBuilder({
        ...descriptor,
        handler,
      }),
  });

/**
 * Namespace for scheduler transport builders.
 *
 * Scheduler builders describe time-driven jobs as semantic metadata. They do
 * not create timers, manage workers or execute runtime pipelines.
 *
 * @group Scheduler
 * @intent Public namespace for declaring scheduled jobs as compile-time descriptors.
 * @example Scheduled job with lifecycle
 */
export const scheduler = freeze({
  job: (): SchedulerJobBuilder =>
    createJobBuilder(
      freeze({
        kind: "scheduler.job",
        cron: "",
        lifecycle: emptyLifecycleDescriptor(),
      }),
    ),
});
