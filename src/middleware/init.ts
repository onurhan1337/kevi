import { Context, Next } from "hono";
import { cors } from "hono/cors";
import { registry } from "../config";
import { ServiceDefinition } from "../types/config";

type Variables = {
  service: ServiceDefinition;
};

export const initApp = async (
  c: Context<{ Bindings: Env; Variables: Variables }>,
  next: Next,
) => {
  const token = c.req.header("X-Kevi-Token");
  const service = token ? registry[token as keyof typeof registry] : undefined;

  if (service) {
    c.set("service", service);
  }

  if (c.env.API_TOKEN && token !== c.env.API_TOKEN && !service) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const origins = service?.allowedOrigins ? [...service.allowedOrigins] : ["*"];

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
