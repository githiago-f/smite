export { cron, interval, nextFire } from "./schedule.js";
export type { CompiledCron, FieldMatcher, JobSchedule } from "./schedule.js";

export { job, runJob } from "./job.js";
export type {
  JobBuilder,
  JobDescriptor,
  JobHandler,
  JobHandlerDescriptor,
  JobRun,
} from "./job.js";

export { scheduler } from "./scheduler.js";
export type { JobScheduler, SchedulerOptions } from "./scheduler.js";

export { jobsOf } from "./collector.js";
export type { CollectedJob } from "./collector.js";

import { jobsOf } from "./collector.js";
import { job } from "./job.js";
import { cron, interval } from "./schedule.js";
import { scheduler } from "./scheduler.js";

/**
 * The jobs namespace: one import for the whole scheduled-jobs app extensor.
 *
 * @group Surface
 * @example Declare a jobs bundle
 */
export const jobs = {
  cron,
  interval,
  job,
  jobsOf,
  scheduler,
};
