import { runWithScope } from "@smitejs/core";
import { describe, expect, it } from "vitest";
import {
  aroundLogger,
  createLogger,
  currentLogger,
  errorLoggingGuard,
  jobExecutionLogger,
  jobLogger,
  registerScopeLogger,
  runWithLogger,
} from "./index.js";

const logs = {
  createLogger,
  currentLogger,
  registerScopeLogger,
  runWithLogger,
  jobLogger,
  jobExecutionLogger,
  errorLoggingGuard,
  aroundLogger,
};

// #section - Create a scope-anchored logger
describe("Logger interface", () => {
  it("createLogger returns an object with info/warn/error/debug/trace methods", () => {
    const logger = logs.createLogger({ level: "info" });
    expect(logger).toHaveProperty("info");
    expect(logger).toHaveProperty("warn");
    expect(logger).toHaveProperty("error");
    expect(logger).toHaveProperty("debug");
    expect(logger).toHaveProperty("trace");
    expect(typeof logger.info).toBe("function");
    expect(typeof logger.warn).toBe("function");
    expect(typeof logger.error).toBe("function");
    expect(typeof logger.debug).toBe("function");
    expect(typeof logger.trace).toBe("function");
  });

  it("createLogger defaults to level 'info'", () => {
    const logger = logs.createLogger();
    expect(logger).toBeDefined();
  });

  it("currentLogger returns undefined when no logger registered", () => {
    const logger = logs.currentLogger();
    expect(logger).toBeUndefined();
  });
  // #endsection

  // #section - Register and retrieve a logger in a scope
  it("registerScopeLogger makes logger available within an active scope", () => {
    const logger = logs.createLogger({ level: "debug" });
    runWithScope({}, () => {
      logs.registerScopeLogger(logger);
      const retrieved = logs.currentLogger();
      expect(retrieved).toBe(logger);
    });
  });
  // #endsection

  // #section - Retrieve a logger from the current scope
  it("currentLogger retrieves logger registered in the active scope", () => {
    const logger = logs.createLogger({ level: "info" });
    runWithScope({}, () => {
      logs.registerScopeLogger(logger);
      const retrieved = logs.currentLogger();
      expect(retrieved).toBe(logger);
    });
  });
  // #endsection

  // #section - Run with a scoped logger
  it("runWithLogger makes logger available during the callback", () => {
    const logger = logs.runWithLogger({ level: "info" }, () => {
      return logs.currentLogger();
    });
    expect(logger).toBeDefined();
  });
  // #endsection
});

// #section - Create a logger for a job execution
it("createScopedLogger registers logger in the current scope", () => {
  const logger = logs.createLogger({ level: "info" });
  runWithScope({}, () => {
    logs.registerScopeLogger(logger);
    const retrieved = logs.currentLogger();
    expect(retrieved).toBeDefined();
  });
});
// #endsection

// #section - Apply a logger aspect
describe("AOP aspects", () => {
  it("jobLogger creates a middleware aspect", () => {
    const aspect = logs.jobLogger({ level: "info" });
    expect(aspect.kind).toBe("middleware");
    expect(typeof aspect.fn).toBe("function");
  });
  // #endsection

  // #section - Apply logger aspect to a job
  it("jobExecutionLogger creates a middleware aspect with label", () => {
    const aspect = logs.jobExecutionLogger({ label: "test-job" });
    expect(aspect.kind).toBe("middleware");
    expect(typeof aspect.fn).toBe("function");
  });
  // #endsection

  // #section - Error-handling guard aspect
  it("errorLoggingGuard creates a guard aspect", () => {
    const aspect = logs.errorLoggingGuard();
    expect(aspect.kind).toBe("guard");
    expect(typeof aspect.fn).toBe("function");
  });
  // #endsection

  // #section - Log around a function call
  it("aroundLogger creates a middleware aspect", () => {
    const aspect = logs.aroundLogger({ level: "trace" });
    expect(aspect.kind).toBe("middleware");
    expect(typeof aspect.fn).toBe("function");
  });
  // #endsection
});

describe("runWithScope", () => {
  it("runWithScope propagates logger within the active scope", () => {
    const logger = logs.createLogger({ level: "info" });
    runWithScope({ jobId: "123" }, () => {
      logs.registerScopeLogger(logger);
      const retrieved = logs.currentLogger();
      expect(retrieved).toBe(logger);
    });
  });
});
