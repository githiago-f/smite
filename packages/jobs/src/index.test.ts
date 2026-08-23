import { childrenOf, clear, createApp, lookup } from "@smitejs/core";
import { afterEach, describe, expect, it } from "vitest";
import {
  cron,
  interval,
  job,
  jobs,
  jobsOf,
  nextFire,
  scheduler,
} from "./index.js";

afterEach(() => clear());

describe("schedules", () => {
  it("computes a cron fire using a shared cron builder", () => {
    // #section - Schedule a job on a cron expression
    const everyFive = cron("5 * * * *");
    // #endsection

    expect(everyFive.kind).toBe("cron");
    expect(
      nextFire(everyFive, new Date("2026-01-01T00:00:00Z"))?.getTime(),
    ).toBe(Date.UTC(2026, 0, 1, 0, 5, 0));
  });

  it("computes the first matching minute boundary", () => {
    // #section - Compute the next cron fire
    const workdayNine = cron("0 9-17 * * 1-5");
    const monday = new Date("2026-01-05T00:00:00Z"); // 2026-01-05 is a Monday
    const next = nextFire(workdayNine, monday);
    // #endsection

    expect(next?.getTime()).toBe(Date.UTC(2026, 0, 5, 9, 0, 0));
  });

  it("fires an interval at the offset", () => {
    const everyTenSeconds = interval(10_000);
    const fromAt = new Date("2026-01-01T00:00:00Z");
    expect(nextFire(everyTenSeconds, fromAt)?.getTime()).toBe(
      Date.UTC(2026, 0, 1, 0, 0, 10),
    );
  });

  it("rejects malformed cron expressions", () => {
    expect(() => cron("12 30")).toThrow(/fields/);
    expect(() => cron("0 25 * * *")).toThrow(/out of range/);
    expect(() => cron("bad * * * *")).toThrow(/Invalid/);
  });
});

describe("job builders", () => {
  it("schedules a job on a cron expression", () => {
    // #section - Define a job
    const app = createApp();
    const descriptor = job(app, "nightly")
      .cron("0 0 * * *")
      .run(() => undefined);
    // #endsection

    expect(descriptor.__kind).toBe("jobs.job");
    expect(descriptor.data.id).toBe("nightly");
    expect(descriptor.data.schedule.kind).toBe("cron");
    expect(childrenOf(app, "jobs.job").length).toBe(1);
    const handlerNode = childrenOf(descriptor, "jobs.handler")[0];
    expect(handlerNode).toBeDefined();
    expect(lookup(descriptor.__key)).toBeDefined();
  });

  it("schedules a job on an interval", () => {
    // #section - Schedule a job on an interval
    const app = createApp();
    const heartbeat = job(app, "heartbeat")
      .every(5_000)
      .run(() => undefined);
    // #endsection
    expect(heartbeat.data.schedule.kind).toBe("interval");
  });

  it("collects an app's jobs", () => {
    const app = createApp();

    // #section - Collect an app's jobs
    job(app, "cleanup")
      .every(60_000)
      .run(() => undefined);
    job(app, "report")
      .cron("0 2 * * 1")
      .run(() => undefined);
    const collected = jobsOf(app);
    // #endsection

    expect(collected.map((entry) => entry.id).sort()).toEqual([
      "cleanup",
      "report",
    ]);
    expect(collected[0]?.schedule.kind).toBe("interval");
  });

  it("exposes a namespace bundle", () => {
    // #section - Declare a jobs bundle
    const jobsBundle = jobs;
    // #endsection

    expect(typeof jobsBundle.cron).toBe("function");
    expect(typeof jobsBundle.interval).toBe("function");
    expect(typeof jobsBundle.job).toBe("function");
    expect(typeof jobsBundle.scheduler).toBe("function");
    expect(typeof jobsBundle.jobsOf).toBe("function");
  });
});

describe("scheduler executor", () => {
  it("fires every job once on start", async () => {
    const app = createApp();
    const runs: Record<string, number> = {};
    job(app, "a")
      .cron("* * * * *")
      .run(() => {
        runs.a = (runs.a ?? 0) + 1;
      });
    job(app, "b")
      .every(10)
      .run(() => {
        runs.b = (runs.b ?? 0) + 1;
      });

    const handle = scheduler(app);
    expect(handle.jobs.map((entry) => entry.id).sort()).toEqual(["a", "b"]);
    await handle.start();

    expect(runs.a).toBe(1);
    expect(runs.b).toBe(1);
    handle.stop();
  });

  it("arms timers on tick and stops them", async () => {
    const app = createApp();
    const runs: number[] = [];
    job(app, "ticker")
      .every(5)
      .run(() => {
        runs.push(runs.length);
      });

    // #section - Schedule an app's jobs
    const handle = scheduler(app);
    const stop = handle.tick();
    // #endsection

    await new Promise((resolve) => setTimeout(resolve, 30));
    stop();

    expect(runs.length).toBeGreaterThan(0);
  });

  it("surfaces onError for a failing job", async () => {
    const app = createApp();
    const errors: string[] = [];
    job(app, "boom")
      .every(10)
      .run(() => {
        throw new Error("bad");
      });

    const handle = scheduler(app, {
      onError: ({ id, error }) => {
        errors.push(`${id}:${String(error)}`);
      },
    });
    await handle.start();
    handle.stop();

    expect(errors).toEqual(["boom:Error: bad"]);
  });
});
