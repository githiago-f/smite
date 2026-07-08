import { http, lifecycle } from "@smitejs/core";
import { describe, expect, it } from "vitest";
import { emitExpressModule } from "./index.js";

describe("@smitejs/runtime-express", () => {
  it("emits an express-ready module with custom lifecycle handlers", () => {
    // #section - Express module emission
    const ValidateUserInput = lifecycle.pipe(
      "validate-user-input",
      ({ body }: { readonly body: unknown }) => body,
      { source: "http.body" },
    );
    const LocalizedErrors = lifecycle.filter(
      "localized-errors",
      (error: Error, { locale }: { readonly locale: string }) => ({
        status: 400,
        message: `${locale}:${error.message}`,
      }),
      { dictionary: "errors" },
    );

    const controller = http
      .controller()
      .use(
        lifecycle.create().pipes(ValidateUserInput).filters(LocalizedErrors)
          .descriptor,
      )
      .path("/users")
      .routes(
        http.route.post("/", function createUser() {
          return { id: "1" };
        }),
      );

    const emitted = emitExpressModule(controller.descriptor, {
      appIdentifier: "app",
      handlerIdentifier: "dependencies",
    });
    // #endsection

    expect(emitted.dependencies).toEqual([
      "validate-user-input",
      "localized-errors",
      "createUser",
    ]);
    expect(emitted.source).toContain('import express from "express";');
    expect(emitted.source).toContain(
      '"validate-user-input": (...args: readonly unknown[]) => unknown;',
    );
    expect(emitted.source).toContain(
      '"localized-errors": (...args: readonly unknown[]) => unknown;',
    );
    expect(emitted.source).toContain("createApp");
    expect(emitted.source).toContain(
      'req.body = await dependencies["validate-user-input"](req.body, { req, res, next });',
    );
    expect(emitted.source).toContain(
      'await dependencies["localized-errors"](error, { req, res, next });',
    );
    expect(emitted.source).toContain('app.use("/users", appRouter);');
  });
});
