import { createExpressRuntime } from "@smite/express";
import express from "express";
import { controllers } from "./components.js";

const port = Number(process.env.PORT ?? "3000");
const host = process.env.HOST ?? "127.0.0.1";

const app = express();

app.use(express.json());
app.use(createExpressRuntime({ controllers }));

app.listen(port, host, () => {
  console.log(`HTTP example listening on http://${host}:${port}`);
});
