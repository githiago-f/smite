import { serveNode } from "@smite/http";
import { buildApp } from "./app.mjs";

const PORT = Number(process.env.PORT ?? 3000);
const { app } = buildApp();
const server = serveNode(app);

server.listen(PORT, () => {
  console.log(`@smite/http example listening on http://127.0.0.1:${PORT}`);
  console.log("GET /users/42 →", "curl http://127.0.0.1:3000/users/42");
});
