import { Context, Next } from "hono";
import { AccessRole, ServiceDefinition } from "../types/config";

type Variables = {
  service: ServiceDefinition;
};

export const authorize = (requiredRole: AccessRole) => {
  return async (c: Context<{ Variables: Variables }>, next: Next) => {
    const service = c.get("service");
    const requestOrigin = c.req.header("Origin");

    if (service.allowedOrigins && !service.allowedOrigins.includes("*")) {
      if (!requestOrigin || !service.allowedOrigins.includes(requestOrigin)) {
        return c.json({ error: "Origin Not Allowed" }, 403);
      }
    }

    if (service.role !== requiredRole && c.req.method !== "GET") {
      return c.json(
        {
          error: "Permission Denied",
          required: requiredRole,
          current: service.role,
        },
        403,
      );
    }

    await next();
  };
};
