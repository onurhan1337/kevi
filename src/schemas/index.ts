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
    value: z.any(),
    metadata: z.record(z.any()).optional(),
    ttl: z.number().positive().optional(),
  })
);

export { keySchema, kvBodySchema };
