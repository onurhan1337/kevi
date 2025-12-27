import { Context, Hono } from "hono";
import { keySchema, kvBodySchema } from "../schemas";
import { authorize } from "../middleware/auth";
import { ServiceDefinition, ServiceName } from "../types/config";
import { registry } from "../config";
import { Env } from "../types/env";

type Variables = {
  service: ServiceDefinition;
  serviceId: ServiceName<typeof registry>;
};
const app = new Hono<{ Bindings: Partial<Env>; Variables: Variables }>();

/**
 * Resolved KV context with type safety.
 * Contains the KV namespace, final key (with prefix), raw key, service definition, and service ID.
 */
type ResolvedKV = {
  kv: KVNamespace;
  finalKey: string;
  rawKey: string;
  service: ServiceDefinition;
  serviceId: ServiceName<typeof registry>;
};

/**
 * Resolves KV namespace and applies prefix isolation based on service definition.
 *
 * This function ensures strict prefix isolation for multi-tenant scenarios:
 * - Multiple services can share the same KV namespace
 * - Keys are prefixed with service prefix (e.g., "dev:key_1", "prod:key_1")
 * - Prefix is applied consistently across all operations (GET, POST, DELETE, LIST)
 * - Fully type-safe with no any types
 *
 * @param c - Hono context with service definition in Variables
 * @returns Resolved KV context with type safety
 * @throws Error if service is not resolved in context
 */
const getResolvedKV = (
  c: Context<{ Bindings: Partial<Env>; Variables: Variables }>
): ResolvedKV => {
  const service = c.get("service");
  const serviceId = c.get("serviceId");

  if (!service || !serviceId) {
    throw new Error("Service not resolved in context");
  }

  if (!c.env) {
    throw new Error("Environment not available");
  }

  const storageKey = service.storage as keyof Env;
  const kv = c.env[storageKey] as KVNamespace | undefined;

  if (!kv) {
    throw new Error(
      `KV namespace '${service.storage}' not found in environment`
    );
  }

  const rawKey = c.req.param("key") || "";

  const finalKey = service.prefix ? `${service.prefix}:${rawKey}` : rawKey;

  return { kv, finalKey, rawKey, service, serviceId };
};

/**
 * List all keys for the current service with prefix isolation.
 * Only returns keys that belong to this service's prefix.
 */
app.get("/", async (c) => {
  const { kv, service } = getResolvedKV(c);

  const list = await kv.list({
    prefix: service.prefix ? `${service.prefix}:` : undefined,
    limit: Number(c.req.query("limit")) || 100,
    cursor: c.req.query("cursor"),
  });

  const keys = list.keys.map((k) => ({
    name: service.prefix
      ? k.name.replace(new RegExp(`^${service.prefix}:`), "")
      : k.name,
    metadata: k.metadata || {},
  }));

  return c.json({
    status: "ok",
    keys,
    cursor: "cursor" in list ? list.cursor : undefined,
    list_complete: list.list_complete,
  });
});

/**
 * Get a specific key value for the current service.
 * Prefix isolation ensures keys from other services are not accessible.
 */
app.get("/:key", keySchema, async (c) => {
  const { kv, finalKey } = getResolvedKV(c);
  const { value, metadata } = await kv.getWithMetadata(finalKey, "json");

  if (!value) {
    return c.json({ error: "Not Found" }, 404);
  }

  return c.json({
    status: "ok",
    data: value,
    metadata: metadata || {},
  });
});

/**
 * Create or update a key-value pair for the current service.
 * Requires admin role. Prefix isolation ensures keys are stored under service namespace.
 *
 * Automatically injects metadata:
 * - updated_by: The resolved serviceId
 * - updated_at: ISO timestamp
 * These are merged with any user-provided metadata.
 */
app.post("/:key", authorize("admin"), keySchema, kvBodySchema, async (c) => {
  const { kv, finalKey, serviceId } = getResolvedKV(c);
  const { value, metadata: userMetadata, ttl } = c.req.valid("json");

  const autoMetadata: Record<string, unknown> = {
    updated_by: serviceId,
    updated_at: new Date().toISOString(),
  };

  const finalMetadata: Record<string, unknown> = {
    ...autoMetadata,
    ...(userMetadata || {}),
  };

  await kv.put(finalKey, JSON.stringify(value), {
    metadata: finalMetadata,
    expirationTtl: ttl,
  });

  return c.json({
    status: "ok",
    message: "Key created/updated successfully",
  });
});

/**
 * Delete a key-value pair for the current service.
 * Requires admin role. Prefix isolation ensures only service's own keys can be deleted.
 */
app.delete("/:key", authorize("admin"), keySchema, async (c) => {
  const { kv, finalKey } = getResolvedKV(c);
  await kv.delete(finalKey);

  return c.json({
    status: "ok",
    message: "Key deleted successfully",
  });
});

export default app;
