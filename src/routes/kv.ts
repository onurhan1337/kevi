import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { registry } from "../config";
import { authorize } from "../middleware/auth";
import { ServiceDefinition } from "../types/config";

type Variables = {
  service: ServiceDefinition;
  finalKey: string;
  kv: KVNamespace;
};

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

const keySchema = zValidator(
  "param",
  z.object({
    key: z
      .string()
      .min(3)
      .max(512)
      .regex(/^[a-zA-Z0-9._-]+$/)
      .optional(),
  }),
);

const kvBodySchema = zValidator(
  "json",
  z.object({
    value: z.any(),
    metadata: z.record(z.any()).optional(),
    ttl: z.number().positive().optional(),
  }),
);

app.use("*", async (c, next) => {
  const token = c.req.header("X-Kevi-Token") as keyof typeof registry;
  const service = registry[token];

  if (!service) return c.json({ error: "Unauthorized" }, 401);

  const key = c.req.param("key") || "";
  c.set("service", service);
  c.set("kv", c.env[service.storage as keyof Env] as KVNamespace);
  c.set("finalKey", service.prefix ? `${service.prefix}:${key}` : key);

  await next();
});

app.get("/", async (c) => {
  const list = await c.get("kv").list({
    prefix: c.get("service").prefix ? `${c.get("service").prefix}:` : undefined,
    limit: Number(c.req.query("limit")) || 100,
    cursor: c.req.query("cursor"),
  });

  return c.json({
    status: "ok",
    keys: list.keys.map((k) => ({
      name: c.get("service").prefix
        ? k.name.replace(`${c.get("service").prefix}:`, "")
        : k.name,
      metadata: k.metadata,
    })),
    cursor: "cursor" in list ? list.cursor : undefined,
    list_complete: list.list_complete,
  });
});

app.get("/:key", keySchema, async (c) => {
  const { value, metadata } = await c
    .get("kv")
    .getWithMetadata(c.get("finalKey"));
  if (!value) return c.json({ error: "Not Found" }, 404);
  return c.json({ status: "ok", data: value, metadata: metadata || {} });
});

app.post("/:key", authorize("admin"), keySchema, kvBodySchema, async (c) => {
  const { value, metadata, ttl } = c.req.valid("json");
  await c
    .get("kv")
    .put(c.get("finalKey"), JSON.stringify(value), {
      metadata,
      expirationTtl: ttl,
    });
  return c.json({ status: "ok" });
});

app.delete("/:key", authorize("admin"), keySchema, async (c) => {
  await c.get("kv").delete(c.get("finalKey"));
  return c.json({ status: "ok" });
});

export default app;
