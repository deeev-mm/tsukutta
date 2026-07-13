import { Hono } from "hono";
import { asc, eq } from "drizzle-orm";
import { categories } from "../db/schema";
import type { AppVariables } from "../lib/auth";
import { requireAuth } from "../lib/auth";
import type { Env } from "../lib/crypto";

export const categoryRoutes = new Hono<{
  Bindings: Env;
  Variables: AppVariables;
}>();

categoryRoutes.use("*", requireAuth);

categoryRoutes.get("/", async (c) => {
  const rows = await c
    .get("db")
    .select()
    .from(categories)
    .where(eq(categories.isActive, 1))
    .orderBy(asc(categories.sortOrder), asc(categories.name))
    .all();

  return c.json({
    categories: rows.map((r) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      sortOrder: r.sortOrder,
    })),
  });
});
