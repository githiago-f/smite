import { createExpressApp } from "./express-app.js";

const port = Number(process.env.PORT ?? "3000");
const host = process.env.HOST ?? "127.0.0.1";

const app = createExpressApp();

app.listen(port, host, () => {
  console.log(`Express-only example listening on http://${host}:${port}`);
});
