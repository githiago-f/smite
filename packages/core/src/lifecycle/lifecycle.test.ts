import { describe, expect, it } from "vitest";
import { lifecycle, mergeLifecycleDescriptors } from "../index.js";

const JwtGuard = lifecycle.guard("jwt");
const HttpErrorsFilter = lifecycle.filter("http-errors");
const LoggerProvider = lifecycle.provider("logger");

describe("lifecycle", () => {
  it("creates immutable reusable compositions", () => {
    const base = lifecycle.create().guards(JwtGuard);
    const extended = base.filters(HttpErrorsFilter).providers(LoggerProvider);

    expect(base.descriptor.entries).toHaveLength(1);
    expect(extended.descriptor.entries.map((entry) => entry.entryKind)).toEqual(
      ["guard", "filter", "provider"],
    );
    expect(Object.isFrozen(extended.descriptor)).toBe(true);
    expect(Object.isFrozen(extended.descriptor.entries)).toBe(true);
  });

  it("merges entries and compositions without mutating inputs", () => {
    const guard = lifecycle.guard("jwt");
    const filter = lifecycle.filter("http-errors");
    const composition = lifecycle.create().use(guard).descriptor;

    const merged = mergeLifecycleDescriptors(composition, filter);

    expect(composition.entries).toEqual([guard.descriptor]);
    expect(merged.entries).toEqual([guard.descriptor, filter.descriptor]);
  });
});
