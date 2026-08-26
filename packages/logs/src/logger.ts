import { registerLogger, runWithScope, ScopeContext } from "@smitejs/core";
import { pino } from "pino";
import type { Logger as PinoLogger } from "pino";

/**
 * Generic structured logger interface.
 * Implementations must be pure (no side effects beyond I/O) and
 * transport-agnostic so callers are not coupled to pino internally.
 */
export interface Logger {
  /** Log at `info` level. */
  info(msg: string, ...meta: unknown[]): void;
  /** Log at `warn` level. */
  warn(msg: string, ...meta: unknown[]): void;
  /** Log at `error` level. */
  error(msg: string, ...meta: unknown[]): void;
  /** Log at `debug` level. */
  debug(msg: string, ...meta: unknown[]): void;
  /** Log at `trace` level. */
  trace(msg: string, ...meta: unknown[]): void;
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
export function createLogger(
  options?: {
    /** pino level filter. @default "info" */
    readonly level?: string;
    /** Extra `base` fields merged into every log line of the scope. */
    readonly base?: Readonly<Record<string, unknown>>;
  },
): Logger {
  const level = options?.level ?? "info";
  const base = options?.base ?? {};

  const pinoLogger = pino({ level, base });

  return {
    info: (msg, ...meta) => pinoLogger.info(msg, ...meta),
    warn: (msg, ...meta) => pinoLogger.warn(msg, ...meta),
    error: (msg, ...meta) => pinoLogger.error(msg, ...meta),
    debug: (msg, ...meta) => pinoLogger.debug(msg, ...meta),
    trace: (msg, ...meta) => pinoLogger.trace(msg, ...meta),
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
    context!.logger = logger;
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
  return registerLogger(
    (context) => context?.logger as Logger | undefined,
  );
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
  registerScopeLogger(logger);
  return run();
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
  context: ScopeContext,
  options?: {
    readonly level?: string;
    readonly base?: Readonly<Record<string, unknown>>;
  },
): Logger {
  const logger = createLogger(options);
  registerLogger((ctx) => {
    ctx.logger = logger;
  });
  return logger;
}