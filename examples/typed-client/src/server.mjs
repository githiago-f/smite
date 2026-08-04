import { serveNode } from "@smite/http";
import { app } from "./app.mjs";

const PORT = Number(process.env.PORT ?? 4000);
const server = serveNode(app);

server.listen(PORT, () => {
  console.log(`typed-client server listening on http://127.0.0.1:${PORT}`);
});
