import { Hono } from "hono";
import { logger } from "hono/logger";
import kvRoute from "./routes/kv";
import { initApp } from "./middleware/init";
import { ServiceDefinition, ServiceName } from "./types/config";
import { registry } from "./config";

type Variables = {
  service: ServiceDefinition;
  serviceId: ServiceName<typeof registry>;
};

/**
 * @description Enterprise middleware patterns for future scaling:
 * @tutorial https://hono.dev/docs/middleware/builtin/combine#usage
 * * @example:
 * app.use('/v1/*', some(
 * every(
 * ipRestriction(getConnInfo, { allowList: ['192.168.0.2'] }),
 * bearerAuth({ token })
 * ),
 * rateLimit()
 * ))
 */
const app = new Hono<{ Bindings: Env; Variables: Variables }>();

app.use("*", logger());

app.use("*", initApp);

app.route("/v1/kv", kvRoute);

export default app;
