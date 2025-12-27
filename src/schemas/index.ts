import { z } from "zod";
import { zValidator } from "@hono/zod-validator";

const keySchema = zValidator(
  "param",
  z.object({
    key: z
      .string()
      .min(3)
      .max(512)
      .regex(/^[a-zA-Z0-9._-]+$/)
      .optional(),
  })
);

const kvBodySchema = zValidator(
  "json",
  z.object({
    value: z.unknown(),
    metadata: z.record(z.string(), z.unknown()).optional(),
    ttl: z.number().positive().optional(),
  })
);

const serviceNameSchema = z
  .string()
  .min(3, "Service name must be at least 3 characters long")
  .max(30, "Service name must be at most 30 characters long")
  .regex(
    /^[a-z0-9-]+$/,
    "Service name can only contain lowercase letters, numbers, and hyphens (-)"
  );

export { keySchema, kvBodySchema, serviceNameSchema };
