import { http } from "@smitejs/http";
import { z } from "zod";

export const app = http
  .app("aws-lambda-example")
  .use(http.requestLogger({ base: { service: "aws-lambda-example" } }));

const readUsers = http.router();
const writeUsers = http.router();

readUsers.accept("GET", "/users/:id").handler((ctx) =>
  http.json({
    id: ctx.params.id,
    include: ctx.query.include ?? "summary",
    session: ctx.request.cookies.session ?? null,
  }),
);

writeUsers
  .input({ body: z.object({ name: z.string().min(1) }) })
  .accept("POST", "/users")
  .handler((ctx) => http.status(201).json({ id: "new-user", ...ctx.body }));

app.use(readUsers, writeUsers);
