import { type ScopeContext, registerLogger, runWithScope } from "@smitejs/core";
import { pino } from "pino";

/**
 * Generic structured logger interface.
 * Implementations must be pure (no side effects beyond I/O) and
 * transport-agnostic so callers are not coupled to pino internally.
 */
export interface Logger {
  info(obj: Record<string, unknown>, msg?: string, ...args: unknown[]): void;
  info(msg: string, ...args: unknown[]): void;
  warn(obj: Record<string, unknown>, msg?: string, ...args: unknown[]): void;
  warn(msg: string, ...args: unknown[]): void;
  error(obj: Record<string, unknown>, msg?: string, ...args: unknown[]): void;
  error(msg: string, ...args: unknown[]): void;
  debug(obj: Record<string, unknown>, msg?: string, ...args: unknown[]): void;
  debug(msg: string, ...args: unknown[]): void;
  trace(obj: Record<string, unknown>, msg?: string, ...args: unknown[]): void;
  trace(msg: string, ...args: unknown[]): void;
}

/**
 * Creates a pino-backed Logger implementing the generic interface.
 * The resulting logger is automatically scope-anchored: it reads the active
 * {@link @smitejs/core} scope and pins itself to it via {@link registerLogger},
 * so that any code in the same async context can retrieve it with
 * {@link currentLogger}.
 *
 * @group Logger
 * @example Create a scope-anchored logger
 */
export function createLogger(options?: {
  /** pino level filter. @default "info" */
  readonly level?: string;
  /** Extra `base` fields merged into every log line of the scope. */
  readonly base?: Readonly<Record<string, unknown>>;
}): Logger {
  const level = options?.level ?? "info";
  const base = options?.base ?? {};

  const pinoLogger = pino({ level, base });

  return {
    info: (...args: unknown[]) =>
      (pinoLogger.info as (...args: unknown[]) => void)(...args),
    warn: (...args: unknown[]) =>
      (pinoLogger.warn as (...args: unknown[]) => void)(...args),
    error: (...args: unknown[]) =>
      (pinoLogger.error as (...args: unknown[]) => void)(...args),
    debug: (...args: unknown[]) =>
      (pinoLogger.debug as (...args: unknown[]) => void)(...args),
    trace: (...args: unknown[]) =>
      (pinoLogger.trace as (...args: unknown[]) => void)(...args),
  };
}

/**
 * Registers a logger into the current {@link @smitejs/core} scope so that
 * `currentLogger()` can retrieve it later.
 *
 * @group Logger
 * @example Register and retrieve a logger in a scope
 */
export function registerScopeLogger(logger: Logger): void {
  registerLogger((context) => {
    if (context) {
      context.logger = logger;
    }
  });
}

/**
 * Returns the logger that was registered for the current scope, or `undefined`
 * when no logger has been registered.
 *
 * @group Logger
 * @example Retrieve a logger from the current scope
 */
export function currentLogger(): Logger | undefined {
  return registerLogger((context) => context?.logger as Logger | undefined);
}

/**
 * Runs a callback with a scope-anchored logger. The logger is registered into
 * the {@link @smitejs/core} scope for the duration of `run`, and is
 * automatically cleaned up after.
 *
 * @group Logger
 * @example Run with a scoped logger
 */
export function runWithLogger<T>(
  options: {
    readonly level?: string;
    readonly base?: Readonly<Record<string, unknown>>;
  },
  run: () => T,
): T {
  const logger = createLogger(options);
  return runWithScope({}, (): T => {
    registerScopeLogger(logger);
    return run();
  });
}

/**
 * Creates a logger that is scoped to a custom context. The logger is registered
 * into a new scope via {@link runWithScope} and retrieved via
 * {@link currentLogger} within that scope.
 *
 * @group Logger
 * @example Create a logger for a job execution
 */
export function createScopedLogger(
  _context: ScopeContext,
  options?: {
    readonly level?: string;
    readonly base?: Readonly<Record<string, unknown>>;
  },
): Logger {
  const logger = createLogger(options);
  registerLogger((ctx) => {
    if (ctx) {
      ctx.logger = logger;
    }
  });
  return logger;
}
