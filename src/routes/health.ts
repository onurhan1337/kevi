import { Hono } from "hono";

const startTime = Date.now();

const app = new Hono().get("/status", (c) => {
  const uptimeInSeconds = Math.floor((Date.now() - startTime) / 1000);

  return c.json({
    status: "ok",
    uptime: `${uptimeInSeconds}s`,
    timestamp: new Date().toISOString(),
  });
});

export default app;
