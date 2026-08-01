import { chain } from "@smite/fp";
import { describe, expect, it } from "vitest";
import { http, event, handleify, lifecycle, scheduler } from "../index.js";
import type { HttpExecutionContext } from "../index.js";

// #section - Compose an application
const extractToken = chain(http.authHeader("Bearer"), http.cookie("session"));
const profileId = chain(http.param("id"), http.query("userID"));

const canViewOwnProfile = lifecycle.guard("own-profile", (context) => {
  const token = extractToken(context).unwrapOrElse(() => "");
  const id = profileId(context).unwrapOrElse(() => "");

  return id === token;
});

const Users = http
  .controller()
  .use(canViewOwnProfile)
  .path("/users")
  .routes(
    http.route.get("/", () => [
      { name: "Ada Lovelace", email: "ada@analytical.dev" },
      { name: "Grace Hopper", email: "grace@compiler.dev" },
    ]),
    http.route.get("/:id", (context: HttpExecutionContext) => ({
      id: context.request.params.id,
      name: "Ada Lovelace",
      email: "ada@analytical.dev",
    })),
  );

const RefreshCache = scheduler
  .job()
  .cron("0 0 * * *")
  .handler(() => "cache refreshed");
// #endsection

describe("applications", () => {
  it("describes intent as routes, controllers and jobs", () => {
    expect(Users.descriptor.path).toBe("/users");
    expect(Users.descriptor.routes.map((route) => route.path)).toEqual([
      "/",
      "/:id",
    ]);
    expect(RefreshCache.descriptor.cron).toBe("0 0 * * *");
  });

  it("turns intent into plain functions and feeds them events", async () => {
    // #section - Execute the application
    const serve = handleify(Users);
    const refresh = handleify(RefreshCache);

    const ownProfile = event
      .request()
      .path("/users/1DSOFJOQ32SD")
      .headers({ Authorization: "Bearer 1DSOFJOQ32SD" })
      .build();

    const otherProfile = event
      .request()
      .path("/users/11DSOFJOQ32SD")
      .headers({ Authorization: "Bearer 1DSOFJOQ32SD" })
      .build();

    const own = await serve(ownProfile);
    const other = await serve(otherProfile);
    const refreshed = await refresh();
    // #endsection

    expect(own).toEqual({
      body: {
        id: "1DSOFJOQ32SD",
        name: "Ada Lovelace",
        email: "ada@analytical.dev",
      },
    });
    expect(other).toEqual({ status: 403, body: { error: "Forbidden" } });
    expect(refreshed).toBe("cache refreshed");
  });

  it("falls back from the path parameter to the query string", async () => {
    const serve = handleify(Users);

    const response = await serve(
      event
        .request()
        .method("GET")
        .path("/users")
        .headers({ Authorization: "Bearer 1DSOFJOQ32SD" })
        .query({ userID: "1DSOFJOQ32SD" })
        .build(),
    );

    expect(response).toEqual({
      body: [
        { name: "Ada Lovelace", email: "ada@analytical.dev" },
        { name: "Grace Hopper", email: "grace@compiler.dev" },
      ],
    });
  });
});
