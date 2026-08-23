import { childrenOf } from "@smitejs/core";
import type { AppDescriptor, Descriptor } from "@smitejs/core";
import type { EmptySignal } from "@smitejs/handlers";
import type { JobSchedule } from "./schedule.js";

/**
 * A job as seen by artifact generators: its id, schedule, and the run function
 * the scheduler invokes. `run` takes a zero-input signal.
 *
 * @group Collector
 */
export interface CollectedJob {
  readonly id: string;
  readonly schedule: JobSchedule;
  readonly run: (signal: EmptySignal) => void | Promise<void>;
}

type JobNode = Descriptor<"jobs.job", { id: string; schedule: JobSchedule }>;
type JobHandlerNode = Descriptor<
  "jobs.handler",
  { fn: (signal: EmptySignal) => void | Promise<void> }
>;

/**
 * Walks an app's `jobs.job` children and returns the collected jobs with their
 * schedules and run functions. Shared by artifact generators and the scheduler
 * executor.
 *
 * @group Collector
 * @example Collect an app's jobs
 */
export function jobsOf(app: AppDescriptor): readonly CollectedJob[] {
  return childrenOf(app, "jobs.job").map((node) => {
    const jobNode = node as JobNode;
    const handler = childrenOf(node, "jobs.handler")[0] as
      | JobHandlerNode
      | undefined;
    return {
      id: jobNode.data.id,
      schedule: jobNode.data.schedule,
      run: handler?.data.fn ?? (() => undefined),
    };
  });
}
