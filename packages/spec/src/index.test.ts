import { http, lifecycle } from "@smite/core";
import { describe, expect, it } from "vitest";
import { renderExpressSpec, renderPlantUml } from "./index.js";

describe("renderExpressSpec", () => {
  it("renders the Express wiring specification", () => {
    // #section - Express specification
    const listUsers = () => [{ id: "1", name: "Ada Lovelace" }];

    const ApiGuard = lifecycle.guard("api-key");
    const ParseBody = lifecycle.pipe("parse-body");
    const JsonErrors = lifecycle.filter("json-errors");

    const authenticated = lifecycle
      .create()
      .guards(ApiGuard)
      .pipes(ParseBody)
      .filters(JsonErrors);

    const UsersController = http
      .controller()
      .use(authenticated)
      .path("/users")
      .routes(http.route.get("/", listUsers));

    const spec = renderExpressSpec([UsersController]);
    // #endsection

    expect(spec).toContain('app.use("/users", usersRouter)');
    expect(spec).toContain("| GET | / | listUsers |");
    expect(spec).toContain("1. guard: api-key");
    expect(spec).toContain("2. pipe: parse-body");
    expect(spec).toContain("3. filter: json-errors — runs only on error");
  });

  it("renders per-route lifecycle by merging controller and route policies", () => {
    const listUsers = () => undefined;

    const Controller = http
      .controller()
      .use(lifecycle.create().guards(lifecycle.guard("api-key")))
      .path("/users")
      .routes(
        http.route
          .get("/", listUsers)
          .use(lifecycle.create().pipes(lifecycle.pipe("pagination"))),
      );

    const spec = renderExpressSpec([Controller]);

    expect(spec).toContain("1. guard: api-key");
    expect(spec).toContain("2. pipe: pagination");
  });

  it("handles controllers without lifecycle", () => {
    const ping = () => ({ status: 200, body: { ok: true } });

    const PingController = http
      .controller()
      .path("/ping")
      .routes(http.route.get("/", ping));

    const spec = renderExpressSpec([PingController]);

    expect(spec).toContain("1. none");
  });

  it("handles an empty controller list", () => {
    const spec = renderExpressSpec([]);

    expect(spec).toContain("Generated from 0 controllers.");
    expect(spec).toContain("- none");
  });
});

describe("renderPlantUml", () => {
  it("renders a PlantUML component diagram", () => {
    // #section - PlantUML specification
    const listUsers = () => [{ id: "1", name: "Ada Lovelace" }];
    const createUser = () => ({ status: 201 });

    const ApiGuard = lifecycle.guard("api-key");
    const ParseBody = lifecycle.pipe("parse-body");
    const JsonErrors = lifecycle.filter("json-errors");

    const authenticated = lifecycle
      .create()
      .guards(ApiGuard)
      .pipes(ParseBody)
      .filters(JsonErrors);

    const UsersController = http
      .controller()
      .use(authenticated)
      .path("/users")
      .routes(http.route.get("/", listUsers), http.route.post("/", createUser));

    const diagram = renderPlantUml([UsersController]);
    // #endsection

    expect(diagram).toContain("@startuml");
    expect(diagram).toContain('component "/users" as c0 {');
    expect(diagram).toContain('  component "GET / -> listUsers" as c0r0');
    expect(diagram).toContain('component "guard: api-key" as lc0');
    expect(diagram).toContain("c0r0 --> lc0");
    expect(diagram).toContain("c0r0 --> lc2 : on error");
  });

  it("renders one lifecycle component per distinct entry", () => {
    const listUsers = () => undefined;

    const Controller = http
      .controller()
      .use(lifecycle.create().guards(lifecycle.guard("api-key")))
      .path("/users")
      .routes(http.route.get("/", listUsers));

    const diagram = renderPlantUml([Controller]);

    expect(diagram.match(/guard: api-key/g)?.length).toBe(1);
  });

  it("handles an empty controller list", () => {
    const diagram = renderPlantUml([]);

    expect(diagram).toContain('note "No controllers" as empty');
    expect(diagram).toContain("@enduml");
  });
});
