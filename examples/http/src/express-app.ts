import express from "express";

const API_KEY = "local-dev";

const handleError: express.ErrorRequestHandler = (
  error,
  _request,
  response,
  _next,
) => {
  response.status(400).json({ error: error.message });
};

export const createExpressApp = (): express.Express => {
  const app = express();

  app.use(express.json());
  app.use((request, response, next) => {
    if (request.headers["x-api-key"] !== API_KEY) {
      response.status(403).json({ error: "Forbidden" });
      return;
    }

    next();
  });

  app.get("/users", (_request, response) => {
    response.json([
      { id: "1", name: "Ada Lovelace" },
      { id: "2", name: "Grace Hopper" },
    ]);
  });

  app.post("/users", (request, response) => {
    response.status(201).json({ received: request.body });
  });

  app.use(handleError);

  return app;
};
