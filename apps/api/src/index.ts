import { Hono } from "hono";
import { corsMiddleware } from "./lib/cors";
import { withDb, type AppVariables } from "./lib/auth";
import type { Env } from "./lib/crypto";
import { authRoutes } from "./routes/auth";
import { familyRoutes } from "./routes/family";
import { recipeRoutes } from "./routes/recipes";
import { aiRoutes } from "./routes/ai";
import { cookLogRoutes } from "./routes/cook-logs";

const app = new Hono<{ Bindings: Env; Variables: AppVariables }>();

app.use("*", corsMiddleware);
app.use("*", withDb);

app.get("/", (c) =>
  c.json({ name: "家庭料理ログ API", version: "0.1.0", ok: true }),
);

app.get("/api/v1/health", async (c) => {
  try {
    await c.env.DB.prepare("SELECT 1").first();
    return c.json({ ok: true, db: true });
  } catch {
    return c.json({ ok: false, db: false }, 503);
  }
});

app.route("/api/v1/auth", authRoutes);
app.route("/api/v1/family", familyRoutes);
app.route("/api/v1/recipes", recipeRoutes);
app.route("/api/v1/ai", aiRoutes);
app.route("/api/v1/cook-logs", cookLogRoutes);

export default app;
