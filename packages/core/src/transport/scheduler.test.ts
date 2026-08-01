import { describe, expect, it } from "vitest";
import { lifecycle, scheduler } from "../index.js";

describe("scheduler", () => {
  it("builds immutable job descriptors with lifecycle composition", () => {
    // #section - Scheduled job with lifecycle
    const LoggerProvider = lifecycle.provider("logger");
    const audited = lifecycle.create().providers(LoggerProvider);
    const refreshCache = () => undefined;

    const RefreshCacheJob = scheduler
      .job()
      .use(audited)
      .cron("0 0 * * *")
      .handler(refreshCache);
    // #endsection

    expect(RefreshCacheJob.descriptor).toMatchObject({
      kind: "scheduler.job",
      cron: "0 0 * * *",
      handler: refreshCache,
    });
    expect(RefreshCacheJob.descriptor.lifecycle.entries).toEqual(
      audited.descriptor.entries,
    );
    expect(Object.isFrozen(RefreshCacheJob.descriptor.lifecycle.entries)).toBe(
      true,
    );
  });

  it("keeps earlier job builders immutable", () => {
    const base = scheduler.job();
    const cleanup = base.cron("0 0 * * *");

    expect(base.descriptor.cron).toBe("");
    expect(cleanup.descriptor.cron).toBe("0 0 * * *");
    expect(base.descriptor.handler).toBeUndefined();
    expect(cleanup.descriptor.handler).toBeUndefined();
  });
});
