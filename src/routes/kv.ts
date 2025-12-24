import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { registry } from "../config";
import { ServiceDefinition } from "../types/config";

type Variables = {
  service: ServiceDefinition;
  finalKey: string;
  kv: KVNamespace;
};

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

const keySchema = zValidator(
  "param",
  z.object({ key: z.string().min(3).max(512) }),
);
const bodySchema = zValidator("json", z.object({ value: z.any() }));

app.use("/:key", async (c, next) => {
  const apiKey = c.req.param("apiKey") as keyof typeof registry;
  const service = registry[apiKey];

  if (!service) return c.json({ error: "Unauthorized" }, 401);

  const key = c.req.param("key");
  const storageKey = service.storage as keyof Env;

  c.set("service", service);
  c.set("kv", c.env[storageKey] as KVNamespace);
  c.set("finalKey", service.prefix ? `${service.prefix}:${key}` : key);

  await next();
});

app.get("/:key", keySchema, async (c) => {
  const value = await c.get("kv").get(c.get("finalKey"));
  if (!value) return c.json({ error: "Not Found" }, 404);

  try {
    return c.json({ status: "ok", data: JSON.parse(value) });
  } catch {
    return c.json({ status: "ok", data: value });
  }
});

app.post("/:key", keySchema, bodySchema, async (c) => {
  if (c.get("service").role === "read-only")
    return c.json({ error: "Forbidden" }, 403);

  const { value } = c.req.valid("json");
  const data =
    typeof value === "object" ? JSON.stringify(value) : String(value);

  await c.get("kv").put(c.get("finalKey"), data);
  return c.json({ status: "ok" });
});

app.delete("/:key", keySchema, async (c) => {
  if (c.get("service").role === "read-only")
    return c.json({ error: "Forbidden" }, 403);

  await c.get("kv").delete(c.get("finalKey"));
  return c.json({ status: "ok" });
});

export default app;
