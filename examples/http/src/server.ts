import { createSmiteApp } from "./smite-app.js";

const port = Number(process.env.PORT ?? "3000");
const host = process.env.HOST ?? "127.0.0.1";

const app = createSmiteApp();

app.listen(port, host, () => {
  console.log(`Smite + Express example listening on http://${host}:${port}`);
});
