import Fastify from "fastify";

const app = Fastify();

app.get("/", async () => ({ ok: true }));

app.get("/users", async (req) => ({
  q: typeof req.query.q === "string" ? req.query.q : null,
  users: [],
}));

app.get("/users/:id", async (req) => ({ id: req.params.id }));

app.get("/users/:id/posts/:postId", async (req) => ({
  id: req.params.id,
  postId: req.params.postId,
}));

app.listen({ port: Number(process.env.PORT ?? 8082), host: "0.0.0.0" }, () => {
  console.log(`[fastify] listening on ${process.env.PORT ?? 8082}`);
});
