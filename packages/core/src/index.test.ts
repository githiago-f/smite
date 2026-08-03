import { afterEach, describe, expect, it } from "vitest";
import {
  children,
  childrenOf,
  clear,
  createApp,
  defineDescriptor,
  finalizeDescriptor,
  lookup,
  lookupAll,
  refine,
  register,
  relate,
  relationships,
} from "./index.js";

afterEach(() => clear());

const route = (key = "GET /users/:id") =>
  defineDescriptor("http.route", key, { path: "/users/:id", method: "GET" });

const childIndex = (app: ReturnType<typeof createApp>): unknown =>
  (app as unknown as { [children]?: unknown })[children];

describe("nodes (defineDescriptor)", () => {
  it("returns { __kind, __key, data } with the exact inputs", () => {
    const d = route();
    expect(d.__kind).toBe("http.route");
    expect(d.__key).toBe("GET /users/:id");
    expect(d.data).toEqual({ path: "/users/:id", method: "GET" });
  });

  it("freezes the data snapshot at creation", () => {
    expect(Object.isFrozen(route().data)).toBe(true);
  });

  it("registers into the global registry", () => {
    const d = route();
    expect(lookup("GET /users/:id")).toBe(d);
  });

  it("throws when registering the same key twice", () => {
    defineDescriptor("http.route", "dup", {});
    expect(() => register(defineDescriptor("http.route", "dup", {}))).toThrow(
      /dup/,
    );
  });

  it("lookup('missing') is undefined and lookupAll filters by kind", () => {
    route();
    createApp("api");
    expect(lookup("missing")).toBeUndefined();
    const routes = lookupAll("http.route");
    expect(routes).toHaveLength(1);
    expect(routes[0]).toBe(lookup("GET /users/:id"));
    expect(lookupAll("app")).toHaveLength(1);
  });
});

describe("edges (relate / childrenOf)", () => {
  it("relate returns a relationship node", () => {
    const app = createApp();
    const edge = relate(app, "http.route", route());
    expect(edge.__kind).toBe("relationship");
    expect(edge.data.relation).toBe("http.route");
  });

  it("uses a composite key", () => {
    const app = createApp();
    const edge = relate(app, "http.route", route());
    expect(edge.__key).toBe("app->http.route->GET /users/:id");
  });

  it("registers the relationship", () => {
    const app = createApp();
    relate(app, "http.route", route());
    const rels = relationships();
    expect(rels).toHaveLength(1);
    const rel = rels[0];
    expect(rel?.data.from).toBe("app");
    expect(rel?.data.to).toBe("GET /users/:id");
  });

  it("childrenOf returns children by relation and across relations", () => {
    const app = createApp();
    const r = route();
    relate(app, "http.route", r);
    expect(childrenOf(app, "http.route")).toEqual([r]);
    expect(childrenOf(app)).toEqual([r]);
  });

  it("hides the child index from Object.keys", () => {
    const app = createApp();
    const r = route();
    relate(app, "http.route", r);
    expect(Object.keys(r)).toEqual(["__kind", "__key", "data"]);
  });

  it("childrenOf on a node with no edges returns []", () => {
    expect(childrenOf(route())).toEqual([]);
  });

  it("throws on duplicate relate", () => {
    const app = createApp();
    const r = route();
    relate(app, "http.route", r);
    expect(() => relate(app, "http.route", r)).toThrow(/http.route/);
  });
});

describe("junction (createApp)", () => {
  it("createApp('api') creates an app node", () => {
    const app = createApp("api");
    expect(app.__kind).toBe("app");
    expect(app.__key).toBe("api");
    expect(app.data.name).toBe("api");
  });

  it("unnamed app gets key 'app'", () => {
    expect(createApp().__key).toBe("app");
  });

  it("second unnamed app throws (duplicate)", () => {
    createApp();
    expect(() => createApp()).toThrow(/app/);
  });
});

describe("lifecycle (refine / finalizeDescriptor)", () => {
  it("refine keeps node identity and updates data", () => {
    const r = route();
    refine(r, { summary: "x" });
    expect(lookup("GET /users/:id")).toBe(r);
    expect((r.data as { summary?: string }).summary).toBe("x");
  });

  it("finalizeDescriptor freezes the reachable subtree", () => {
    const app = createApp();
    const r = route();
    relate(app, "http.route", r);
    finalizeDescriptor(app);
    expect(Object.isFrozen(app)).toBe(true);
    expect(Object.isFrozen(app.data)).toBe(true);
    expect(Object.isFrozen(r)).toBe(true);
    expect(Object.isFrozen(childIndex(app))).toBe(true);
  });

  it("refine after finalize throws TypeError", () => {
    const app = createApp();
    const r = route();
    relate(app, "http.route", r);
    finalizeDescriptor(app);
    expect(() => refine(r, { summary: "late" })).toThrow(TypeError);
  });

  it("finalizeDescriptor terminates on a cyclic graph", () => {
    const app = createApp();
    relate(app, "http.route", app);
    expect(() => finalizeDescriptor(app)).not.toThrow();
  });
});

describe("registry isolation", () => {
  it("clear() empties the global", () => {
    route();
    createApp("api");
    expect(lookupAll("http.route")).toHaveLength(1);
    clear();
    expect(lookupAll("http.route")).toHaveLength(0);
    expect(lookupAll("app")).toHaveLength(0);
  });
});

describe("documentation examples", () => {
  it("creates an app junction", () => {
    // #section - Create an app junction
    const app = createApp("store");
    // #endsection

    expect(app.__kind).toBe("app");
    expect(app.__key).toBe("store");
  });

  it("defines and looks up a descriptor", () => {
    // #section - Define and look up a descriptor
    const route = defineDescriptor("http.route", "GET /users/:id", {
      path: "/users/:id",
      method: "GET",
    });
    const found = lookup("GET /users/:id");
    // #endsection

    expect(found).toBe(route);
  });

  it("relates nodes and walks children", () => {
    // #section - Relate nodes and walk children
    const app = createApp("api");
    const route = defineDescriptor("http.route", "GET /users/:id", {
      path: "/users/:id",
      method: "GET",
    });
    const edge = relate(app, "http.route", route);
    const routes = childrenOf(app, "http.route");
    // #endsection

    expect(edge.__kind).toBe("relationship");
    expect(routes).toContain(route);
  });

  it("refines descriptor data", () => {
    // #section - Refine descriptor data
    const route = defineDescriptor("http.route", "GET /users/:id", {
      path: "/users/:id",
      method: "GET",
    });
    refine(route, { summary: "list users" });
    // #endsection

    expect((route.data as { summary?: string }).summary).toBe("list users");
  });

  it("finalizes the descriptor graph", () => {
    // #section - Finalize the descriptor graph
    const app = createApp("api");
    const route = defineDescriptor("http.route", "GET /users/:id", {
      path: "/users/:id",
      method: "GET",
    });
    relate(app, "http.route", route);
    finalizeDescriptor(app);
    // #endsection

    expect(Object.isFrozen(app)).toBe(true);
    expect(Object.isFrozen(route)).toBe(true);
  });

  it("queries and clears the registry", () => {
    // #section - Query and clear the registry
    const app = createApp("api");
    const route = defineDescriptor("http.route", "GET /users/:id", {
      path: "/users/:id",
      method: "GET",
    });
    relate(app, "http.route", route);

    const apps = lookupAll("app");
    const routes = lookupAll("http.route");
    const rels = relationships();
    clear();
    // #endsection

    expect(apps).toHaveLength(1);
    expect(routes).toContain(route);
    expect(rels).toHaveLength(1);
    expect(lookupAll("app")).toHaveLength(0);
  });
});
