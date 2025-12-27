import { Context, Next } from "hono";
import { AccessRole, ServiceDefinition, ServiceName } from "../types/config";
import { registry } from "../config";
import { isGetMethod, isWriteMethod } from "../types/http";
import { isPublicKey } from "../utils/public-key";

type Variables = {
  service: ServiceDefinition;
  serviceId: ServiceName<typeof registry>;
};

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

    const rawKey = c.req.param("key") || "";
    const method = c.req.method;
    const isGetRequest = isGetMethod(method);
    const isPublic = isPublicKey(rawKey, serviceId, service.publicKeys);
    const isWriteOp = isWriteMethod(method);

    if (isGetRequest && isPublic) {
      return await next();
    }

    const requestOrigin = c.req.header("Origin");

    if (service.allowedOrigins) {
      const allowedOriginsSet = new Set(service.allowedOrigins);
      const allowsWildcard = allowedOriginsSet.has("*");

      if (!allowsWildcard) {
        if (!requestOrigin || !allowedOriginsSet.has(requestOrigin)) {
          return c.json(
            {
              error: "Forbidden",
              message: `Origin '${requestOrigin}' is not allowed for service '${serviceId}'`,
            },
            403
          );
        }
      }
    }

    if (isWriteOp && service.role !== "admin") {
      return c.json(
        {
          error: "Permission Denied",
          message: `Service '${serviceId}' with role '${service.role}' cannot perform ${method} operations. Admin role required.`,
          required: "admin",
          current: service.role,
        },
        403
      );
    }

    if (service.role !== requiredRole && !isGetRequest) {
      return c.json(
        {
          error: "Permission Denied",
          message: `Service '${serviceId}' with role '${service.role}' cannot perform ${method} operations`,
          required: requiredRole,
          current: service.role,
        },
        403
      );
    }

    await next();
  };
};
