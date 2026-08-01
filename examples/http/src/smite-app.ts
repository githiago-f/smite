import { createExpressRuntime } from "@smite/express";
import express from "express";
import { controllers } from "./components.js";

export const createSmiteApp = (): express.Express => {
  const app = express();

  app.use(express.json());
  app.use(createExpressRuntime({ controllers }));

  return app;
};
