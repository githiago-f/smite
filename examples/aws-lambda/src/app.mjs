import { http } from "@smitejs/http";
import { z } from "zod";

export const app = http.app("aws-lambda-example");

const readUsers = http.route(app);
const writeUsers = http.route(app);

readUsers.accept("GET", "/users/:id").handler((ctx) =>
  http.json({
    id: ctx.params.id,
    include: ctx.query.include ?? "summary",
    session: ctx.request.cookies.session ?? null,
  }),
);

writeUsers
  .req({ body: z.object({ name: z.string().min(1) }) })
  .accept("POST", "/users")
  .handler((ctx) => http.status(201).json({ id: "new-user", ...ctx.body }));
