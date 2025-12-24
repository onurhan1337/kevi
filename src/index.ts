import { Hono } from "hono";
import healthRoute from "./routes/health";

const app = new Hono();

app.route("/v1", healthRoute);

export default app;
