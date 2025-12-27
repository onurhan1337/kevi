import { Context, Next } from "hono";
import { cors } from "hono/cors";
import { registry } from "../config";
import { ServiceDefinition, ServiceName } from "../types/config";
import { isGetMethod } from "../types/http";
import { isPublicKey } from "../utils/public-key";
import { Env } from "../types/env";

type Variables = {
  service: ServiceDefinition;
  serviceId: ServiceName<typeof registry>;
};

function resolveTokenToServiceId(
  token: string,
  env: Partial<Env>
): ServiceName<typeof registry> | undefined {
  if (!env) return undefined;
  const tokenKey = `TOKEN_${token}` as keyof Env;
  const serviceId = env[tokenKey];

  if (typeof serviceId === "string" && serviceId in registry) {
    return serviceId as ServiceName<typeof registry>;
  }

  return undefined;
}

export const initApp = async (
  c: Context<{ Bindings: Partial<Env>; Variables: Variables }>,
  next: Next
) => {
  if (!c.env || !("KEVI_STORAGE" in c.env)) {
    return c.json(
      {
        error: "Not Supported",
        message:
          "KV operations are only available on Cloudflare Workers runtime. This deployment is for documentation only.",
      },
      503
    );
  }

  const token = c.req.header("X-Kevi-Token");

  if (!token) {
    return c.json(
      { error: "Unauthorized", message: "X-Kevi-Token header is missing" },
      401
    );
  }

  let serviceId = resolveTokenToServiceId(token, c.env);

  if (!serviceId && c.env.API_TOKEN && token === c.env.API_TOKEN) {
    if ("admin" in registry) {
      serviceId = "admin" as ServiceName<typeof registry>;
    } else {
      return c.json(
        {
          error: "Unauthorized",
          message:
            "Token valid but no matching service definition found in config.",
        },
        401
      );
    }
  }

  if (!serviceId) {
    return c.json(
      {
        error: "Unauthorized",
        message: "Invalid or missing X-Kevi-Token header",
      },
      401
    );
  }

  const serviceDefinition = registry[serviceId];

  if (!serviceDefinition) {
    return c.json(
      {
        error: "Unauthorized",
        message:
          "Token valid but no matching service definition found in config.",
      },
      401
    );
  }

  c.set("service", serviceDefinition);
  c.set("serviceId", serviceId);

  const rawKey = c.req.param("key") || "";
  const method = c.req.method;
  const isGetRequest = isGetMethod(method);
  const isPublic = isPublicKey(rawKey, serviceId, serviceDefinition.publicKeys);

  let origins: readonly string[];

  if (isGetRequest && isPublic) {
    origins = ["*"];
  } else {
    origins = serviceDefinition.allowedOrigins || ["*"];
  }

  const originsSet = new Set(origins);
  const firstOrigin = origins[0];

  const corsHandler = cors({
    origin: (origin) => {
      if (originsSet.has("*")) return "*";
      return originsSet.has(origin || "") ? origin : firstOrigin;
    },
    allowMethods: ["GET", "POST", "DELETE", "OPTIONS"],
    allowHeaders: ["X-Kevi-Token", "Content-Type"],
    maxAge: 600,
  });

  return await corsHandler(c, next);
};
