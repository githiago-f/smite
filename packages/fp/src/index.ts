type Unary<Input, Output> = (input: Input) => Output;
type MaybePromise<Value> = PromiseLike<Value> | Value;
type Predicate<Value> = (value: Value) => boolean;

const freeze = <Value extends object>(value: Value): Readonly<Value> =>
  Object.freeze(value);

/**
 * Metadata symbol attached to composed functions created by {@link flow}.
 *
 * The property is non-enumerable, so normal runtime iteration and
 * serialization ignore it. Compiler and registry tooling can opt in by reading
 * this symbol directly.
 *
 * @group Composition
 */
export const compositionMetadata: unique symbol = Symbol.for(
  "@smite/fp/compositionMetadata",
);

/**
 * Describes a single function in a composed pipeline.
 *
 * @group Composition
 */
export interface CompositionStep {
  readonly name: string;
  readonly index: number;
}

/**
 * Compile-time friendly metadata for a composed function.
 *
 * @group Composition
 */
export interface CompositionMetadata {
  readonly kind: "fp.flow";
  readonly steps: readonly CompositionStep[];
}

/**
 * Function value returned by {@link flow}.
 *
 * @group Composition
 */
export type FlowFunction<Input, Output> = Unary<Input, Output> & {
  readonly [compositionMetadata]?: CompositionMetadata;
};

/**
 * Returns the input unchanged.
 *
 * @group Function Utilities
 */
export const identity = <Value>(value: Value): Value => value;

/**
 * Creates a function that always returns the same value.
 *
 * @group Function Utilities
 */
export const constant =
  <Value>(value: Value): (() => Value) =>
  () =>
    value;

/**
 * Function that intentionally does nothing.
 *
 * @group Function Utilities
 */
export const noop = (): void => undefined;

/**
 * Applies a value to a sequence of unary functions.
 *
 * @group Composition
 * @example Pipe value transformation
 */
export function pipe<Value>(value: Value): Value;
export function pipe<Value, A>(value: Value, a: Unary<Value, A>): A;
export function pipe<Value, A, B>(
  value: Value,
  a: Unary<Value, A>,
  b: Unary<A, B>,
): B;
export function pipe<Value, A, B, C>(
  value: Value,
  a: Unary<Value, A>,
  b: Unary<A, B>,
  c: Unary<B, C>,
): C;
export function pipe<Value, A, B, C, D>(
  value: Value,
  a: Unary<Value, A>,
  b: Unary<A, B>,
  c: Unary<B, C>,
  d: Unary<C, D>,
): D;
export function pipe<Value, A, B, C, D, E>(
  value: Value,
  a: Unary<Value, A>,
  b: Unary<A, B>,
  c: Unary<B, C>,
  d: Unary<C, D>,
  e: Unary<D, E>,
): E;
export function pipe<Value, A, B, C, D, E, F>(
  value: Value,
  a: Unary<Value, A>,
  b: Unary<A, B>,
  c: Unary<B, C>,
  d: Unary<C, D>,
  e: Unary<D, E>,
  f: Unary<E, F>,
): F;
export function pipe(
  value: unknown,
  ...steps: readonly Unary<unknown, unknown>[]
): unknown {
  return steps.reduce((current, step) => step(current), value);
}

/**
 * Composes unary functions from left to right.
 *
 * The returned function carries non-enumerable composition metadata that can be
 * consumed by compile-time tooling without changing runtime behavior.
 *
 * @group Composition
 * @example Flow function composition
 * @example Flow composition metadata
 */
export function flow<Value>(): FlowFunction<Value, Value>;
export function flow<Value, A>(a: Unary<Value, A>): FlowFunction<Value, A>;
export function flow<Value, A, B>(
  a: Unary<Value, A>,
  b: Unary<A, B>,
): FlowFunction<Value, B>;
export function flow<Value, A, B, C>(
  a: Unary<Value, A>,
  b: Unary<A, B>,
  c: Unary<B, C>,
): FlowFunction<Value, C>;
export function flow<Value, A, B, C, D>(
  a: Unary<Value, A>,
  b: Unary<A, B>,
  c: Unary<B, C>,
  d: Unary<C, D>,
): FlowFunction<Value, D>;
export function flow<Value, A, B, C, D, E>(
  a: Unary<Value, A>,
  b: Unary<A, B>,
  c: Unary<B, C>,
  d: Unary<C, D>,
  e: Unary<D, E>,
): FlowFunction<Value, E>;
export function flow<Value, A, B, C, D, E, F>(
  a: Unary<Value, A>,
  b: Unary<A, B>,
  c: Unary<B, C>,
  d: Unary<C, D>,
  e: Unary<D, E>,
  f: Unary<E, F>,
): FlowFunction<Value, F>;
export function flow(
  ...steps: readonly Unary<unknown, unknown>[]
): FlowFunction<unknown, unknown> {
  const composed = ((input: unknown) =>
    steps.reduce((current, step) => step(current), input)) as FlowFunction<
    unknown,
    unknown
  >;
  const metadata: CompositionMetadata = freeze({
    kind: "fp.flow",
    steps: Object.freeze(
      steps.map((step, index) =>
        freeze({
          index,
          name: step.name.length > 0 ? step.name : `step${index + 1}`,
        }),
      ),
    ),
  });

  Object.defineProperty(composed, compositionMetadata, {
    configurable: false,
    enumerable: false,
    value: metadata,
  });

  return composed;
}

/**
 * Reads composition metadata from a function when it was created by
 * {@link flow}.
 *
 * @group Composition
 */
export const getCompositionMetadata = (
  fn: unknown,
): CompositionMetadata | undefined =>
  typeof fn === "function"
    ? (fn as { readonly [compositionMetadata]?: CompositionMetadata })[
        compositionMetadata
      ]
    : undefined;

/**
 * Optional value without `null` or `undefined` control flow.
 *
 * @group Option
 * @example Option optional values
 */
export class Option<Value> {
  private constructor(private readonly state: OptionState<Value>) {}

  static some<Value>(value: Value): Option<Value> {
    return new Option(freeze({ tag: "some", value }));
  }

  static none<Value = never>(): Option<Value> {
    return new Option(noneState);
  }

  static fromNullable<Value>(value: Value | null | undefined): Option<Value> {
    return value == null ? Option.none<Value>() : Option.some(value);
  }

  isSome(): boolean {
    return this.state.tag === "some";
  }

  isNone(): boolean {
    return this.state.tag === "none";
  }

  map<Next>(mapper: Unary<Value, Next>): Option<Next> {
    return this.state.tag === "some"
      ? Option.some(mapper(this.state.value))
      : Option.none();
  }

  flatMap<Next>(mapper: Unary<Value, Option<Next>>): Option<Next> {
    return this.state.tag === "some" ? mapper(this.state.value) : Option.none();
  }

  filter(predicate: Predicate<Value>): Option<Value> {
    return this.state.tag === "some" && predicate(this.state.value)
      ? this
      : Option.none();
  }

  tap(effect: Unary<Value, void>): Option<Value> {
    if (this.state.tag === "some") {
      effect(this.state.value);
    }

    return this;
  }

  unwrapOr(fallback: Value): Value {
    return this.state.tag === "some" ? this.state.value : fallback;
  }

  unwrapOrElse(fallback: () => Value): Value {
    return this.state.tag === "some" ? this.state.value : fallback();
  }
}

type OptionState<Value> =
  | Readonly<{ readonly tag: "some"; readonly value: Value }>
  | Readonly<{ readonly tag: "none" }>;

const noneState = freeze({ tag: "none" as const });

/**
 * Represents a value that is either left or right.
 *
 * @group Either
 * @example Either two-track values
 */
export class Either<Left, Right> {
  private constructor(private readonly state: EitherState<Left, Right>) {}

  static left<Left, Right = never>(value: Left): Either<Left, Right> {
    return new Either<Left, Right>(freeze({ tag: "left", value }));
  }

  static right<Right, Left = never>(value: Right): Either<Left, Right> {
    return new Either<Left, Right>(freeze({ tag: "right", value }));
  }

  isLeft(): boolean {
    return this.state.tag === "left";
  }

  isRight(): boolean {
    return this.state.tag === "right";
  }

  map<Next>(mapper: Unary<Right, Next>): Either<Left, Next> {
    return this.state.tag === "right"
      ? Either.right<Next, Left>(mapper(this.state.value))
      : Either.left<Left, Next>(this.state.value);
  }

  flatMap<Next, NextLeft = never>(
    mapper: Unary<Right, Either<NextLeft, Next>>,
  ): Either<Left | NextLeft, Next> {
    return this.state.tag === "right"
      ? mapper(this.state.value)
      : Either.left<Left, Next>(this.state.value);
  }

  mapLeft<NextLeft>(mapper: Unary<Left, NextLeft>): Either<NextLeft, Right> {
    return this.state.tag === "left"
      ? Either.left<NextLeft, Right>(mapper(this.state.value))
      : Either.right<Right, NextLeft>(this.state.value);
  }

  unwrapOr(fallback: Right): Right {
    return this.state.tag === "right" ? this.state.value : fallback;
  }
}

type EitherState<Left, Right> =
  | Readonly<{ readonly tag: "left"; readonly value: Left }>
  | Readonly<{ readonly tag: "right"; readonly value: Right }>;

/**
 * Success or failure without exception-driven control flow.
 *
 * @group Result
 * @example Result success pipeline
 */
export class Result<Value, ErrorValue = Error> {
  private constructor(private readonly state: ResultState<Value, ErrorValue>) {}

  static ok<Value, ErrorValue = never>(
    value: Value,
  ): Result<Value, ErrorValue> {
    return new Result(freeze({ tag: "ok", value }));
  }

  static err<ErrorValue, Value = never>(
    error: ErrorValue,
  ): Result<Value, ErrorValue> {
    return new Result(freeze({ error, tag: "err" }));
  }

  static fromThrowable<Value, ErrorValue = unknown>(
    operation: () => Value,
    mapError: Unary<unknown, ErrorValue> = identity as Unary<
      unknown,
      ErrorValue
    >,
  ): Result<Value, ErrorValue> {
    try {
      return Result.ok(operation());
    } catch (error) {
      return Result.err(mapError(error));
    }
  }

  isOk(): boolean {
    return this.state.tag === "ok";
  }

  isErr(): boolean {
    return this.state.tag === "err";
  }

  map<Next>(mapper: Unary<Value, Next>): Result<Next, ErrorValue> {
    return this.state.tag === "ok"
      ? Result.ok(mapper(this.state.value))
      : Result.err(this.state.error);
  }

  flatMap<Next, NextError = never>(
    mapper: Unary<Value, Result<Next, NextError>>,
  ): Result<Next, ErrorValue | NextError> {
    return this.state.tag === "ok"
      ? mapper(this.state.value)
      : Result.err(this.state.error);
  }

  mapErr<NextError>(
    mapper: Unary<ErrorValue, NextError>,
  ): Result<Value, NextError> {
    return this.state.tag === "err"
      ? Result.err(mapper(this.state.error))
      : Result.ok(this.state.value);
  }

  recover(mapper: Unary<ErrorValue, Value>): Result<Value, never> {
    return this.state.tag === "err"
      ? Result.ok(mapper(this.state.error))
      : Result.ok(this.state.value);
  }

  tap(effect: Unary<Value, void>): Result<Value, ErrorValue> {
    if (this.state.tag === "ok") {
      effect(this.state.value);
    }

    return this;
  }

  tapErr(effect: Unary<ErrorValue, void>): Result<Value, ErrorValue> {
    if (this.state.tag === "err") {
      effect(this.state.error);
    }

    return this;
  }

  unwrapOr(fallback: Value): Value {
    return this.state.tag === "ok" ? this.state.value : fallback;
  }

  unwrapOrElse(fallback: Unary<ErrorValue, Value>): Value {
    return this.state.tag === "ok"
      ? this.state.value
      : fallback(this.state.error);
  }

  match<OkOutput, ErrOutput>(
    ok: Unary<Value, OkOutput>,
    err: Unary<ErrorValue, ErrOutput>,
  ): OkOutput | ErrOutput {
    return this.state.tag === "ok"
      ? ok(this.state.value)
      : err(this.state.error);
  }
}

type ResultState<Value, ErrorValue> =
  | Readonly<{ readonly tag: "ok"; readonly value: Value }>
  | Readonly<{ readonly error: ErrorValue; readonly tag: "err" }>;

/**
 * Lazy asynchronous computation.
 *
 * @group Task
 * @example Task lazy async work
 */
export class Task<Value> {
  private constructor(private readonly operation: () => Promise<Value>) {}

  static from<Value>(operation: () => MaybePromise<Value>): Task<Value> {
    return new Task(() => Promise.resolve().then(operation));
  }

  static of<Value>(value: Value): Task<Value> {
    return new Task(() => Promise.resolve(value));
  }

  map<Next>(mapper: Unary<Value, MaybePromise<Next>>): Task<Next> {
    return new Task(async () => mapper(await this.run()));
  }

  flatMap<Next>(mapper: Unary<Value, Task<Next>>): Task<Next> {
    return new Task(async () => mapper(await this.run()).run());
  }

  tap(effect: Unary<Value, MaybePromise<void>>): Task<Value> {
    return new Task(async () => {
      const value = await this.run();
      await effect(value);
      return value;
    });
  }

  run(): Promise<Value> {
    return this.operation();
  }
}

/**
 * Lazy asynchronous computation that resolves to a {@link Result}.
 *
 * @group TaskResult
 * @example TaskResult async failure pipeline
 */
export class TaskResult<Value, ErrorValue = Error> {
  private constructor(private readonly task: Task<Result<Value, ErrorValue>>) {}

  static ok<Value, ErrorValue = never>(
    value: Value,
  ): TaskResult<Value, ErrorValue> {
    return new TaskResult(Task.of(Result.ok(value)));
  }

  static err<ErrorValue, Value = never>(
    error: ErrorValue,
  ): TaskResult<Value, ErrorValue> {
    return new TaskResult(Task.of(Result.err(error)));
  }

  static fromResult<Value, ErrorValue>(
    result: Result<Value, ErrorValue>,
  ): TaskResult<Value, ErrorValue> {
    return new TaskResult(Task.of(result));
  }

  static from<Value, ErrorValue = unknown>(
    operation: () => MaybePromise<Value>,
    mapError: Unary<unknown, ErrorValue> = identity as Unary<
      unknown,
      ErrorValue
    >,
  ): TaskResult<Value, ErrorValue> {
    return new TaskResult(
      Task.from(async () => {
        try {
          return Result.ok(await operation());
        } catch (error) {
          return Result.err(mapError(error));
        }
      }),
    );
  }

  map<Next>(
    mapper: Unary<Value, MaybePromise<Next>>,
  ): TaskResult<Next, ErrorValue> {
    return new TaskResult<Next, ErrorValue>(
      Task.from<Result<Next, ErrorValue>>(async () =>
        (await this.run()).match(
          async (value) => Result.ok(await mapper(value)),
          async (error) => Result.err<ErrorValue, Next>(error),
        ),
      ),
    );
  }

  flatMap<Next, NextError = never>(
    mapper: Unary<Value, TaskResult<Next, NextError>>,
  ): TaskResult<Next, ErrorValue | NextError> {
    return new TaskResult<Next, ErrorValue | NextError>(
      Task.from<Result<Next, ErrorValue | NextError>>(async () =>
        (await this.run()).match(
          (value) => mapper(value).run(),
          async (error) => Result.err<ErrorValue | NextError, Next>(error),
        ),
      ),
    );
  }

  mapErr<NextError>(
    mapper: Unary<ErrorValue, NextError>,
  ): TaskResult<Value, NextError> {
    return new TaskResult(this.task.map((result) => result.mapErr(mapper)));
  }

  recover(
    mapper: Unary<ErrorValue, MaybePromise<Value>>,
  ): TaskResult<Value, never> {
    return new TaskResult<Value, never>(
      Task.from<Result<Value, never>>(async () =>
        (await this.run()).match(
          async (value) => Result.ok<Value, never>(value),
          async (error) => Result.ok(await mapper(error)),
        ),
      ),
    );
  }

  tap(effect: Unary<Value, MaybePromise<void>>): TaskResult<Value, ErrorValue> {
    return new TaskResult<Value, ErrorValue>(
      Task.from<Result<Value, ErrorValue>>(async () =>
        (await this.run()).match(
          async (value) => {
            await effect(value);
            return Result.ok<Value, ErrorValue>(value);
          },
          async (error) => Result.err<ErrorValue, Value>(error),
        ),
      ),
    );
  }

  run(): Promise<Result<Value, ErrorValue>> {
    return this.task.run();
  }
}

/**
 * Fluent matcher entry point.
 *
 * @group Match
 * @example Match result values
 */
export const Matcher = freeze({
  from: <Value, ErrorValue>(result: Result<Value, ErrorValue>) =>
    new ResultMatcher(result),
});

class ResultMatcher<Value, ErrorValue, OkOutput = never, ErrOutput = never> {
  constructor(
    private readonly result: Result<Value, ErrorValue>,
    private readonly okHandler?: Unary<Value, OkOutput>,
    private readonly errHandler?: Unary<ErrorValue, ErrOutput>,
  ) {}

  ok<NextOk>(
    handler: Unary<Value, NextOk>,
  ): ResultMatcher<Value, ErrorValue, NextOk, ErrOutput> {
    return new ResultMatcher(this.result, handler, this.errHandler);
  }

  err<NextErr>(
    handler: Unary<ErrorValue, NextErr>,
  ): ResultMatcher<Value, ErrorValue, OkOutput, NextErr> {
    return new ResultMatcher(this.result, this.okHandler, handler);
  }

  run(): OkOutput | ErrOutput {
    return this.result.match(
      (value) => {
        if (!this.okHandler) {
          throw new Error("Missing ok matcher branch.");
        }

        return this.okHandler(value);
      },
      (error) => {
        if (!this.errHandler) {
          throw new Error("Missing err matcher branch.");
        }

        return this.errHandler(error);
      },
    );
  }
}

/**
 * Creates a predicate that requires every predicate to pass.
 *
 * @group Predicate
 * @example Predicate composition
 */
export const and =
  <Value>(...predicates: readonly Predicate<Value>[]): Predicate<Value> =>
  (value) =>
    predicates.every((predicate) => predicate(value));

/**
 * Creates a predicate that requires at least one predicate to pass.
 *
 * @group Predicate
 */
export const or =
  <Value>(...predicates: readonly Predicate<Value>[]): Predicate<Value> =>
  (value) =>
    predicates.some((predicate) => predicate(value));

/**
 * Negates a predicate.
 *
 * @group Predicate
 */
export const not =
  <Value>(predicate: Predicate<Value>): Predicate<Value> =>
  (value) =>
    !predicate(value);

/**
 * Checks whether a value is a string.
 *
 * @group Predicate
 */
export const isString = (value: unknown): value is string =>
  typeof value === "string";

/**
 * Checks whether a value is a number that is not `NaN`.
 *
 * @group Predicate
 */
export const isNumber = (value: unknown): value is number =>
  typeof value === "number" && !Number.isNaN(value);

/**
 * Checks whether a string is a UUID.
 *
 * @group Predicate
 */
export const isUUID = (value: unknown): value is string =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(
    value,
  );

/**
 * Checks whether a value is empty.
 *
 * Empty values are empty strings, empty arrays, empty maps, empty sets and
 * objects without enumerable keys.
 *
 * @group Predicate
 */
export const isEmpty = (value: unknown): boolean => {
  if (typeof value === "string" || Array.isArray(value)) {
    return value.length === 0;
  }

  if (value instanceof Map || value instanceof Set) {
    return value.size === 0;
  }

  if (value !== null && typeof value === "object") {
    return Object.keys(value).length === 0;
  }

  return false;
};
