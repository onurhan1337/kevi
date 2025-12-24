import { Hono } from "hono";
import { cors } from "hono/cors";
import kvRoute from "./routes/kv";

/**
 * Enterprise middleware patterns for future scaling:
 * https://hono.dev/docs/middleware/builtin/combine#usage
 * * Example:
 * app.use('/v1/*', some(
 * every(
 * ipRestriction(getConnInfo, { allowList: ['192.168.0.2'] }),
 * bearerAuth({ token })
 * ),
 * rateLimit()
 * ))
 */

const app = new Hono<{ Bindings: Env }>();

app.use("*", async (c, next) => {
  const apiToken = c.req.header("X-Kevi-Token");

  if (c.env.API_TOKEN && apiToken !== c.env.API_TOKEN) {
    return c.json({ error: "Forbidden" }, 403);
  }

  return await cors()(c, next);
});

app.route("/v1/:apiKey", kvRoute);

export default app;
