import { Context, Next } from "hono";
import { cors } from "hono/cors";
import { registry } from "../config";
import { ServiceDefinition, ServiceName } from "../types/config";

type Variables = {
  service: ServiceDefinition;
  serviceId: ServiceName<typeof registry>;
};

type EnvWithTokens = Env & {
  API_TOKEN?: string;
  [key: `TOKEN_${string}`]: string | undefined;
};

function resolveTokenToServiceId(
  token: string,
  env: EnvWithTokens
): ServiceName<typeof registry> | undefined {
  const tokenKey = `TOKEN_${token}` as keyof EnvWithTokens;
  const serviceId = env[tokenKey];

  if (typeof serviceId === "string" && serviceId in registry) {
    return serviceId as ServiceName<typeof registry>;
  }

  return undefined;
}

export const initApp = async (
  c: Context<{ Bindings: EnvWithTokens; Variables: Variables }>,
  next: Next
) => {
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

  const origins = serviceDefinition.allowedOrigins
    ? [...serviceDefinition.allowedOrigins]
    : ["*"];

  const corsHandler = cors({
    origin: (origin) => {
      if (origins.includes("*")) return "*";
      return origins.includes(origin) ? origin : origins[0];
    },
    allowMethods: ["GET", "POST", "DELETE", "OPTIONS"],
    allowHeaders: ["X-Kevi-Token", "Content-Type"],
    maxAge: 600,
  });

  return await corsHandler(c, next);
};
