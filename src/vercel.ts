declare global {
  interface KVNamespace {
    get(key: string, options?: any): Promise<any>;
    put(key: string, value: string, options?: any): Promise<void>;
    delete(key: string): Promise<void>;
    list(options?: any): Promise<any>;
  }
}

import { Hono } from "hono";
import { logger } from "hono/logger";
import { handle } from "hono/vercel";
import { Scalar } from "@scalar/hono-api-reference";
import { generateOpenAPISpec } from "./utils/openapi";

const app = new Hono();

app.use("*", logger());

app.get("/health", (c) => {
  return c.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
    runtime: "vercel",
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

export default handle(app);
