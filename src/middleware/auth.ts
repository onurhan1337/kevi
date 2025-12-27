import { Context, Next } from "hono";
import { AccessRole, ServiceDefinition, ServiceName } from "../types/config";
import { registry } from "../config";

type Variables = {
  service: ServiceDefinition;
  serviceId: ServiceName<typeof registry>;
};

/**
 * Authorization Middleware
 *
 * Enforces role-based access control and origin validation using the resolved Service ID.
 * All authorization logic uses the Service Definition resolved from the Service ID,
 * never interacting with plain-text tokens directly.
 *
 * @param requiredRole - The minimum role required to access the endpoint
 * @returns Middleware function that checks authorization
 */
export const authorize = (requiredRole: AccessRole) => {
  return async (c: Context<{ Variables: Variables }>, next: Next) => {
    const service = c.get("service");
    const serviceId = c.get("serviceId");

    if (!service || !serviceId) {
      return c.json(
        {
          error: "Unauthorized",
          message:
            "Service not identified. Invalid or missing X-Kevi-Token header.",
        },
        401
      );
    }

    const requestOrigin = c.req.header("Origin");

    if (service.allowedOrigins && !service.allowedOrigins.includes("*")) {
      if (!requestOrigin || !service.allowedOrigins.includes(requestOrigin)) {
        return c.json(
          {
            error: "Forbidden",
            message: `Origin '${requestOrigin}' is not allowed for service '${serviceId}'`,
          },
          403
        );
      }
    }

    if (service.role !== requiredRole && c.req.method !== "GET") {
      return c.json(
        {
          error: "Permission Denied",
          message: `Service '${serviceId}' with role '${service.role}' cannot perform ${c.req.method} operations`,
          required: requiredRole,
          current: service.role,
        },
        403
      );
    }

    await next();
  };
};
