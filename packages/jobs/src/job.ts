import { defineDescriptor, relate } from "@smitejs/core";
import type { AppDescriptor, Descriptor } from "@smitejs/core";
import type { EmptyHandler, EmptySignal } from "@smitejs/handlers";
import { emptyHandler, fire } from "@smitejs/handlers";
import { cron, interval } from "./schedule.js";
import type { JobSchedule } from "./schedule.js";

/**
 * The zero-input function a job runs each time it fires.
 *
 * @group Types
 */
export type JobHandler = EmptyHandler;

/**
 * A `jobs.job` IR node: a named schedule and the handler edge that runs it.
 *
 * @group Internals
 */
export interface JobDescriptor
  extends Descriptor<
    "jobs.job",
    { readonly id: string; readonly schedule: JobSchedule }
  > {}

/**
 * A node wrapping the function a job runs.
 *
 * @group Internals
 */
export interface JobHandlerDescriptor
  extends Descriptor<"jobs.handler", { readonly fn: JobHandler }> {}

/**
 * The terminal step of a {@link JobBuilder}: binds the run function to the
 * schedule chosen and registers the job node under the app.
 *
 * @group Builders
 */
export interface JobRun {
  /** Attaches the run function, relates the IR nodes, and returns the job. */
  readonly run: (fn: JobHandler) => JobDescriptor;
}

/**
 * A job builder: choose a cron or interval schedule from one shared
 * `job(app, id)` piece, then bind a run function. Always a builder; returns the
 * `jobs.job` descriptor after `run()`.
 *
 * @group Builders
 * @example Define a job
 */
export interface JobBuilder {
  /** Cron schedule from a 5-field POSIX expression. */
  readonly cron: (expression: string) => JobRun;
  /** Fixed-interval schedule in milliseconds. */
  readonly every: (milliseconds: number) => JobRun;
}

/**
 * Creates a job builder for an app. The common piece — `(app, id)` — yields two
 * schedule builders (`cron()` / `every()`); pick one and `.run(fn)` attaches the
 * `jobs.handler` child and relates the `jobs.job` node under the app.
 *
 * @group Builders
 * @example Schedule a job on a cron expression
 * @example Schedule a job on an interval
 */
export function job(app: AppDescriptor, id: string): JobBuilder {
  const declare = (schedule: JobSchedule): JobRun => ({
    run: (fn: JobHandler): JobDescriptor => {
      const descriptor = defineDescriptor(
        "jobs.job",
        `${app.__key}:job:${id}`,
        {
          id,
          schedule,
        },
      );
      const handlerDescriptor = defineDescriptor(
        "jobs.handler",
        `${descriptor.__key}:handler`,
        { fn: emptyHandler({ name: id }, fn) },
      );
      relate(descriptor, "jobs.handler", handlerDescriptor);
      relate(app, "jobs.job", descriptor);
      return descriptor;
    },
  });

  const builder: JobBuilder = {
    cron: (expression: string) => declare(cron(expression)),
    every: (milliseconds: number) => declare(interval(milliseconds)),
  };
  return builder;
}

/**
 * Fires a job's run function with a zero-input signal at the given (or
 * current) instant.
 *
 * @group Executor
 */
export const runJob = (
  descriptor: { readonly data: { readonly id: string } },
  fn: (signal: EmptySignal) => void | Promise<void>,
  at: number | Date = Date.now(),
): Promise<void> => Promise.resolve(fn(fire(descriptor.data.id, at)));
