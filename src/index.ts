import { Hono } from "hono";
import { logger } from "hono/logger";
import { Scalar } from "@scalar/hono-api-reference";
import kvRoute from "./routes/kv";
import { initApp } from "./middleware/init";
import { ServiceDefinition, ServiceName } from "./types/config";
import { registry } from "./config";
import { generateOpenAPISpec } from "./utils/openapi";
import { Env } from "./types/env";

type Variables = {
  service: ServiceDefinition;
  serviceId: ServiceName<typeof registry>;
};

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

app.use("*", logger());

app.get("/health", (c) => {
  return c.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
  });
});

app.get("/openapi.json", (c) => {
  return c.json(generateOpenAPISpec());
});

app.get(
  "/docs",
  Scalar({
    url: "/openapi.json",
    theme: "default",
    pageTitle: "Kevi API Documentation",
  })
);

app.use("/v1/*", initApp);

app.route("/v1/kv", kvRoute);

export default app;
