import { finalizeDescriptor } from "@smitejs/core";
import type { AppDescriptor } from "@smitejs/core";
import type { EmptySignal } from "@smitejs/handlers";
import { fire } from "@smitejs/handlers";
import { jobsOf } from "./collector.js";
import type { CollectedJob } from "./collector.js";
import { nextFire } from "./schedule.js";

/** A timer id from `setTimeout` or `setInterval`. */
type TimerHandle = ReturnType<typeof setTimeout>;

/**
 * Options for {@link scheduler}.
 *
 * @group Executor
 */
export interface SchedulerOptions {
  /** Invoked before each job runs, with the job id and fire time. */
  readonly onRun?: (entry: {
    readonly id: string;
    readonly at: number;
  }) => void;
  /** Invoked when a job's run function throws or rejects. */
  readonly onError?: (entry: {
    readonly id: string;
    readonly error: unknown;
  }) => void;
  /** Also arms the schedule clock when `start()` runs. */
  readonly start?: boolean;
}

/**
 * A runtime handle returned by {@link scheduler}: the collected jobs, plus
 * `start` (fire everything once) and `tick`/`stop` to drive the fire clock.
 *
 * @group Executor
 */
export interface JobScheduler {
  readonly jobs: readonly CollectedJob[];
  /** Runs every job once immediately; with `{ start: true }` arms the clock. */
  readonly start: () => Promise<void>;
  /** Arms each job's cron/interval timer and returns a one-shot `stop`. */
  readonly tick: () => () => void;
  /** Clears every armed timer. */
  readonly stop: () => void;
}

const signalOf = (job: { readonly id: string }): EmptySignal => fire(job.id);

/**
 * Turns an app into a runtime job scheduler. Walks the app's `jobs.job` IR
 * tree via child refs — never the global registry — so it keeps working in
 * production bundles where collect mode is folded out. `start()` fires every
 * job once; `tick()` arms the cron/interval timers and returns a `stop` for
 * shutdown; `{ start: true }` arms automatically. `onRun`/`onError` observe
 * each fire.
 *
 * @group Executor
 * @example Schedule an app's jobs
 */
export function scheduler(
  app: AppDescriptor,
  options: SchedulerOptions = {},
): JobScheduler {
  finalizeDescriptor(app);

  const jobs = jobsOf(app);
  const timers = new Set<TimerHandle>();

  const runJob = async (job: CollectedJob): Promise<void> => {
    options.onRun?.({ id: job.id, at: Date.now() });
    try {
      await Promise.resolve(job.run(signalOf(job)));
    } catch (error) {
      options.onError?.({ id: job.id, error });
    }
  };

  const armJob = (job: CollectedJob): void => {
    if (job.schedule.kind === "interval") {
      const timer = setInterval(() => {
        void runJob(job);
      }, job.schedule.milliseconds);
      timers.add(timer);
      return;
    }

    const armNext = (): void => {
      const next = nextFire(job.schedule, new Date());
      if (next === null) return;
      const timer = setTimeout(
        () => {
          timers.delete(timer);
          void runJob(job);
          armNext();
        },
        Math.max(0, next.getTime() - Date.now()),
      );
      timers.add(timer);
    };
    armNext();
  };

  const stop = (): void => {
    for (const timer of timers) clearTimer(timer);
    timers.clear();
  };

  return {
    jobs,
    start: async () => {
      for (const job of jobs) {
        await runJob(job);
      }
      if (options.start === true) {
        for (const job of jobs) armJob(job);
      }
    },
    tick: () => {
      for (const job of jobs) armJob(job);
      return stop;
    },
    stop,
  };
}

const clearTimer = (timer: TimerHandle): void => clearInterval(timer);
