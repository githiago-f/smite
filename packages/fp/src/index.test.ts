import { describe, expect, it } from "vitest";
import {
  Either,
  Matcher,
  Option,
  Result,
  Task,
  TaskResult,
  and,
  chain,
  compositionMetadata,
  extractorMetadata,
  flow,
  getCompositionMetadata,
  getExtractorMetadata,
  isNumber,
  isString,
  not,
  pipe,
} from "./index.js";

describe("functional composition", () => {
  it("pipes a value through transformations", () => {
    // #section - Pipe value transformation
    const output = pipe(
      " smite ",
      (value) => value.trim(),
      (value) => value.toUpperCase(),
    );
    // #endsection

    expect(output).toBe("SMITE");
  });

  it("composes reusable functions with flow", () => {
    // #section - Flow function composition
    const validate = (value: string) => value.trim();
    const normalize = (value: string) => value.toLowerCase();
    const persist = (value: string) => ({ name: value });

    const createUser = flow(validate, normalize, persist);
    // #endsection

    expect(createUser(" ADA ")).toEqual({ name: "ada" });
  });

  it("exposes non-enumerable composition metadata", () => {
    // #section - Flow composition metadata
    const validate = (value: string) => value.trim();
    const normalize = (value: string) => value.toLowerCase();
    const persist = (value: string) => ({ name: value });

    const createUser = flow(validate, normalize, persist);
    const metadata = getCompositionMetadata(createUser);
    // #endsection

    expect(metadata).toEqual({
      kind: "fp.flow",
      steps: [
        { index: 0, name: "validate" },
        { index: 1, name: "normalize" },
        { index: 2, name: "persist" },
      ],
    });
    expect(Object.keys(createUser)).toEqual([]);
    expect(createUser[compositionMetadata]).toBe(metadata);
  });
});

describe("Option", () => {
  it("models optional values without nullable control flow", () => {
    // #section - Option optional values
    const name = Option.fromNullable(" Ada ")
      .map((value) => value.trim())
      .filter((value) => value.length > 0)
      .unwrapOr("anonymous");
    // #endsection

    expect(name).toBe("Ada");
    expect(Option.fromNullable<string>(undefined).unwrapOr("anonymous")).toBe(
      "anonymous",
    );
  });
});

describe("Either", () => {
  it("maps right values and left values independently", () => {
    // #section - Either two-track values
    const output = Either.right("5")
      .map(Number)
      .map((value) => value * 2)
      .mapLeft(() => "not-a-number")
      .unwrapOr(0);
    // #endsection

    expect(output).toBe(10);
  });
});

describe("Result", () => {
  it("composes success and recovery pipelines", () => {
    // #section - Result success pipeline
    const saveUser = (name: string) =>
      name.length > 0 ? Result.ok({ name }) : Result.err("missing-name");

    const user = Result.ok(" Ada ")
      .map((value) => value.trim())
      .flatMap(saveUser)
      .recover(() => ({ name: "anonymous" }))
      .tap(({ name }) => name.toLowerCase())
      .unwrapOr({ name: "fallback" });
    // #endsection

    expect(user).toEqual({ name: "Ada" });
  });
});

describe("Task", () => {
  it("runs asynchronous work lazily", async () => {
    let runs = 0;

    // #section - Task lazy async work
    const task = Task.from(async () => "Ada")
      .map((name) => name.toLowerCase())
      .tap(() => {
        runs += 1;
      });
    // #endsection

    expect(runs).toBe(0);
    await expect(task.run()).resolves.toBe("ada");
    expect(runs).toBe(1);
  });
});

describe("TaskResult", () => {
  it("runs lazy async failure-aware pipelines", async () => {
    // #section - TaskResult async failure pipeline
    const task = TaskResult.from(async () => " Ada ")
      .map((value) => value.trim())
      .flatMap((value) =>
        value.length > 0 ? TaskResult.ok(value) : TaskResult.err("empty"),
      )
      .recover(() => "anonymous");

    const result = await task.run();
    // #endsection

    expect(result.unwrapOr("fallback")).toBe("Ada");
  });
});

describe("Matcher", () => {
  it("matches result branches through a fluent API", () => {
    // #section - Match result values
    const output = Matcher.from(Result.err("missing-name"))
      .ok((name) => `created:${name}`)
      .err((error) => `recovered:${error}`)
      .run();
    // #endsection

    expect(output).toBe("recovered:missing-name");
  });
});

describe("Predicate", () => {
  it("composes predicates", () => {
    // #section - Predicate composition
    const isNonEmptyString = and(
      isString,
      not((value: string) => value === ""),
    );

    const valid = isNonEmptyString("smite");
    // #endsection

    expect(valid).toBe(true);
    expect(isNumber(1)).toBe(true);
  });
});

describe("Extractor", () => {
  type HttpLike = {
    readonly cookies: Readonly<Record<string, string | undefined>>;
    readonly headers: Readonly<Record<string, string | undefined>>;
  };

  const cookie = (name: string) => (source: HttpLike) =>
    Option.fromNullable(source.cookies[name]);
  const header = (name: string) => (source: HttpLike) =>
    Option.fromNullable(source.headers[name]);

  it("extracts an optional value from a source", () => {
    // #section - Extract a cookie value
    const extract = (source: HttpLike) =>
      Option.fromNullable(source.cookies.session_id);

    const value = extract({ cookies: { session_id: "abc123" }, headers: {} });
    // #endsection

    expect(value.unwrapOr("missing")).toBe("abc123");
    expect(extract({ cookies: {}, headers: {} }).unwrapOr("missing")).toBe(
      "missing",
    );
  });

  it("chains extractors in order and returns the first value found", () => {
    // #section - Chain cookie and header extractors
    const sessionId = chain(cookie("session_id"), header("x-session-id"));

    const fromCookie = sessionId({
      cookies: { session_id: "abc123" },
      headers: {},
    });
    const fromHeader = sessionId({
      cookies: {},
      headers: { "x-session-id": "header-id" },
    });
    const missing = sessionId({ cookies: {}, headers: {} });
    // #endsection

    expect(fromCookie.unwrapOr("missing")).toBe("abc123");
    expect(fromHeader.unwrapOr("missing")).toBe("header-id");
    expect(missing.isNone()).toBe(true);
  });

  it("returns none for an empty chain", () => {
    const value = chain<HttpLike, string>()({ cookies: {}, headers: {} });

    expect(value.isNone()).toBe(true);
  });

  it("exposes non-enumerable extractor metadata", () => {
    // #section - Extractor metadata
    const read = (source: HttpLike) =>
      Option.fromNullable(source.headers["x-id"]);
    const extractor = chain(read);
    const metadata = getExtractorMetadata(extractor);
    // #endsection

    expect(metadata).toEqual({
      kind: "fp.extractor",
      source: "chain",
      key: "read",
      chain: [
        {
          kind: "fp.extractor",
          source: "custom",
          key: "read",
        },
      ],
    });
    expect(Object.keys(extractor)).toEqual([]);
    expect(extractor[extractorMetadata]).toBe(metadata);
  });

  it("returns undefined metadata for non-extractors", () => {
    expect(getExtractorMetadata(() => "value")).toBeUndefined();
    expect(getExtractorMetadata(42)).toBeUndefined();
  });
});
