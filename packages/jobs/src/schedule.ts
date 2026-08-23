const MINUTE_MS = 60_000;
const CRON_FIELDS = 5;
const LOOK_AHEAD_MS = 366 * 24 * 60 * MINUTE_MS;

/**
 * A job run schedule: either a POSIX cron expression (minute hour day-of-month
 * month day-of-week; `0` and `7` both mean Sunday) or a fixed interval in
 * milliseconds.
 *
 * @group Types
 */
export type JobSchedule =
  | { readonly kind: "cron"; readonly expression: string }
  | { readonly kind: "interval"; readonly milliseconds: number };

/**
 * Builds a cron schedule from a 5-field POSIX expression. Every field accepts
 * a bare value (`*`, `n`), a range (`a-b`), a range with a step (`a-b/n`), a
 * wildcard with a step (for example `*` followed by `/n`), or a
 * comma-separated list of any of those.
 *
 * @group Builders
 * @example Schedule a job on a cron expression
 */
export const cron = (expression: string): JobSchedule => {
  compileCron(expression);
  return { kind: "cron", expression };
};

/**
 * Builds a fixed-interval schedule from a duration in milliseconds.
 *
 * @group Builders
 */
export const interval = (milliseconds: number): JobSchedule => ({
  kind: "interval",
  milliseconds,
});

type Range = { readonly min: number; readonly max: number };

/** Predicate deciding whether a single field value is allowed. */
export type FieldMatcher = (value: number) => boolean;

/** A compiled cron expression: five field matchers plus wildcard flags. */
export interface CompiledCron {
  readonly minute: FieldMatcher;
  readonly hour: FieldMatcher;
  readonly dayOfMonth: FieldMatcher;
  readonly month: FieldMatcher;
  readonly dayOfWeek: FieldMatcher;
  readonly dayOfMonthIsStar: boolean;
  readonly dayOfWeekIsStar: boolean;
}

const compileToken = (token: string, { min, max }: Range): FieldMatcher => {
  const stepMatch = /^(.+?)\/(\d+)$/u.exec(token);
  const step = stepMatch === null ? 1 : Number(stepMatch[2]);
  const base = stepMatch === null ? token : (stepMatch[1] ?? "*");

  let low: number;
  let high: number;
  if (base === "*") {
    low = min;
    high = max;
  } else {
    const range = /^(\d+)(?:-(\d+))?$/u.exec(base);
    if (range === null) {
      throw new Error(`Invalid cron token '${token}'.`);
    }
    low = Number(range[1]);
    high = range[2] === undefined ? low : Number(range[2]);
    if (low < min || high > max || low > high) {
      throw new Error(`Cron token '${token}' is out of range [${min}–${max}].`);
    }
  }

  return (value: number): boolean =>
    value >= low && value <= high && (value - low) % step === 0;
};

const compileField = (field: string, range: Range): [FieldMatcher, boolean] => {
  const tokens = field.split(",").map((token) => token.trim());
  if (tokens.length === 0 || tokens.some((token) => token.length === 0)) {
    throw new Error(`Empty cron field '${field}'.`);
  }
  const matchers = tokens.map((token) => compileToken(token, range));
  return [
    (value: number): boolean => matchers.some((matcher) => matcher(value)),
    tokens.every((token) => token === "*"),
  ];
};

/**
 * Parses a 5-field POSIX cron expression into {@link CompiledCron}.
 *
 * @group Internals
 */
export function compileCron(expr: string): CompiledCron {
  const fields = expr.trim().split(/\s+/u);
  if (fields.length !== CRON_FIELDS) {
    throw new Error(
      `Cron expression '${expr}' must have exactly ${CRON_FIELDS} fields.`,
    );
  }
  const [min, hour, dayOfMonth, month, dayOfWeek] = fields;
  if (
    min === undefined ||
    hour === undefined ||
    dayOfMonth === undefined ||
    month === undefined ||
    dayOfWeek === undefined
  ) {
    throw new Error(`Invalid cron expression '${expr}'.`);
  }

  const [minute] = compileField(min, { min: 0, max: 59 });
  const [hourMatcher] = compileField(hour, { min: 0, max: 23 });
  const [domMatcher, domStar] = compileField(dayOfMonth, { min: 1, max: 31 });
  const [monthMatcher] = compileField(month, { min: 1, max: 12 });
  const [dowMatcher, dowStar] = compileField(dayOfWeek, { min: 0, max: 7 });

  return {
    minute,
    hour: hourMatcher,
    dayOfMonth: domMatcher,
    month: monthMatcher,
    dayOfWeek: (value: number): boolean =>
      dowMatcher(value) || (value === 0 && dowMatcher(7)),
    dayOfMonthIsStar: domStar,
    dayOfWeekIsStar: dowStar,
  };
}

const dayAllows = (
  dom: FieldMatcher,
  dow: FieldMatcher,
  domStar: boolean,
  dowStar: boolean,
  date: number,
  weekday: number,
): boolean => {
  if (!domStar && !dowStar) {
    return dom(date) || dow(weekday);
  }
  if (dowStar) {
    return dom(date);
  }
  return dow(weekday);
};

/**
 * Computes the next moment `schedule` fires at or after `from`. Cron fires on
 * the first matching minute boundary; interval schedules fire `milliseconds`
 * after `from`. Returns `null` when no cron fire is within the look-ahead
 * horizon (one year).
 *
 * @group Executor
 * @example Compute the next cron fire
 */
export function nextFire(schedule: JobSchedule, from: Date): Date | null {
  if (schedule.kind === "interval") {
    return new Date(from.getTime() + schedule.milliseconds);
  }

  const compiled = compileCron(schedule.expression);
  const start = new Date(from);
  start.setUTCSeconds(0, 0);
  start.setUTCMinutes(start.getUTCMinutes() + 1);

  const deadline = start.getTime() + LOOK_AHEAD_MS;
  for (
    let cursor = start;
    cursor.getTime() <= deadline;
    cursor = new Date(cursor.getTime() + MINUTE_MS)
  ) {
    const minuteMatch = compiled.minute(cursor.getUTCMinutes());
    const hourMatch = compiled.hour(cursor.getUTCHours());
    const monthMatch = compiled.month(cursor.getUTCMonth() + 1);
    if (!minuteMatch || !hourMatch || !monthMatch) {
      continue;
    }
    const dayMatch = dayAllows(
      compiled.dayOfMonth,
      compiled.dayOfWeek,
      compiled.dayOfMonthIsStar,
      compiled.dayOfWeekIsStar,
      cursor.getUTCDate(),
      cursor.getUTCDay(),
    );
    if (dayMatch) {
      return cursor;
    }
  }
  return null;
}
