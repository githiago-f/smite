import { handler } from "./handler.mjs";

const invoke = async (event) => {
  const response = await handler(event);
  console.log(`${event.requestContext.http.method} ${event.rawPath}`);
  console.log(response.statusCode, response.body);
};

await invoke({
  version: "2.0",
  rawPath: "/users/42",
  rawQueryString: "include=full",
  cookies: ["session=local"],
  requestContext: { http: { method: "GET", path: "/users/42" } },
});

await invoke({
  version: "2.0",
  rawPath: "/users",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ name: "Ada" }),
  requestContext: { http: { method: "POST", path: "/users" } },
});

await invoke({
  version: "2.0",
  rawPath: "/users",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ name: "" }),
  requestContext: { http: { method: "POST", path: "/users" } },
});
