import express from "express";

const app = express();

app.get("/", (_req, res) => {
  res.json({ ok: true });
});

app.get("/users", (req, res) => {
  res.json({
    q: typeof req.query.q === "string" ? req.query.q : null,
    users: [],
  });
});

app.get("/users/:id", (req, res) => {
  res.json({ id: req.params.id });
});

app.get("/users/:id/posts/:postId", (req, res) => {
  res.json({ id: req.params.id, postId: req.params.postId });
});

app.listen(process.env.PORT ?? 8081, () => {
  console.log(`[express] listening on ${process.env.PORT ?? 8081}`);
});
