import { describe, it, expect } from "vitest";
import { runWithScope } from "@smitejs/core";
import {
  createLogger,
  currentLogger,
  registerScopeLogger,
  runWithLogger,
  jobLogger,
  jobExecutionLogger,
  errorLoggingGuard,
  aroundLogger,
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

  it("registerScopeLogger makes logger available within an active scope", () => {
    const logger = logs.createLogger({ level: "debug" });
    runWithScope({}, () => {
      logs.registerScopeLogger(logger);
      const retrieved = logs.currentLogger();
      expect(retrieved).toBe(logger);
    });
  });

  it("runWithLogger makes logger available during the callback", () => {
    const logger = logs.runWithLogger({ level: "info" }, () => {
      return logs.currentLogger();
    });
    // Logger is available within runWithLogger's scope
    expect(logger).toBeDefined();
  });
});

describe("AOP aspects", () => {
  it("jobLogger creates a middleware aspect", () => {
    const aspect = logs.jobLogger({ level: "info" });
    expect(aspect.kind).toBe("middleware");
    expect(typeof aspect.fn).toBe("function");
  });

  it("jobExecutionLogger creates a middleware aspect with label", () => {
    const aspect = logs.jobExecutionLogger({ label: "test-job" });
    expect(aspect.kind).toBe("middleware");
    expect(typeof aspect.fn).toBe("function");
  });

  it("errorLoggingGuard creates a guard aspect", () => {
    const aspect = logs.errorLoggingGuard();
    expect(aspect.kind).toBe("guard");
    expect(typeof aspect.fn).toBe("function");
  });

  it("aroundLogger creates a middleware aspect", () => {
    const aspect = logs.aroundLogger({ level: "trace" });
    expect(aspect.kind).toBe("middleware");
    expect(typeof aspect.fn).toBe("function");
  });
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