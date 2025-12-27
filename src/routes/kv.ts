import { Context, Hono } from "hono";
import { keySchema, kvBodySchema } from "../schemas";
import { authorize } from "../middleware/auth";
import { ServiceDefinition } from "../types/config";

type Variables = {
  service: ServiceDefinition;
};

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

const getResolvedKV = (c: Context<{ Bindings: Env; Variables: Variables }>) => {
  const service = c.get("service");
  const kv = c.env[service.storage as keyof Env] as KVNamespace;
  const key = c.req.param("key") || "";
  const finalKey = service.prefix ? `${service.prefix}:${key}` : key;
  return { kv, finalKey, service };
};

app.get("/", async (c) => {
  const { kv, service } = getResolvedKV(c);
  const list = await kv.list({
    prefix: service.prefix ? `${service.prefix}:` : undefined,
    limit: Number(c.req.query("limit")) || 100,
    cursor: c.req.query("cursor"),
  });

  return c.json({
    status: "ok",
    keys: list.keys.map((k) => ({
      name: service.prefix ? k.name.replace(`${service.prefix}:`, "") : k.name,
      metadata: k.metadata,
    })),
    cursor: "cursor" in list ? list.cursor : undefined,
    list_complete: list.list_complete,
  });
});

app.get("/:key", keySchema, async (c) => {
  const { kv, finalKey } = getResolvedKV(c);
  const { value, metadata } = await kv.getWithMetadata(finalKey);
  if (!value) return c.json({ error: "Not Found" }, 404);
  return c.json({ status: "ok", data: value, metadata: metadata || {} });
});

app.post("/:key", authorize("admin"), keySchema, kvBodySchema, async (c) => {
  const { kv, finalKey } = getResolvedKV(c);
  const { value, metadata, ttl } = c.req.valid("json");
  await kv.put(finalKey, JSON.stringify(value), {
    metadata,
    expirationTtl: ttl,
  });
  return c.json({ status: "ok" });
});

app.delete("/:key", authorize("admin"), keySchema, async (c) => {
  const { kv, finalKey } = getResolvedKV(c);
  await kv.delete(finalKey);
  return c.json({ status: "ok" });
});

export default app;
