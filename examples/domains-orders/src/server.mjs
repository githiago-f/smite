import { serveNode } from "@smitejs/http";
import { buildApp } from "./app.mjs";

const PORT = Number(process.env.PORT ?? 3000);
const { app } = buildApp();
const server = serveNode(app);

server.listen(PORT, () => {
  console.log(`@smitejs/domain example listening on http://127.0.0.1:${PORT}`);
  console.log(
    "POST /orders   →",
    'curl -X POST http://127.0.0.1:3000/orders -d \'{"sku":"jersey","qty":2}\'',
  );
  console.log("GET /orders/:id →", "curl http://127.0.0.1:3000/orders/<id>");
});
