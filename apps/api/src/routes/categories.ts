import { Hono } from "hono";
import { asc, eq } from "drizzle-orm";
import { categories } from "../db/schema";
import type { AppVariables } from "../lib/auth";
import { requireAuth, requireCookRole } from "../lib/auth";
import { newId, nowIso, type Env } from "../lib/crypto";

export const categoryRoutes = new Hono<{
  Bindings: Env;
  Variables: AppVariables;
}>();

categoryRoutes.use("*", requireAuth);

/** 有効なカテゴリのみ（レシピ付与・絞り込み用） */
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
      isActive: true,
    })),
  });
});

/** 無効含む全件（マスタ管理用・Owner/Cook） */
categoryRoutes.get("/manage", async (c) => {
  const denied = requireCookRole(c.get("user"));
  if (denied) return c.json({ error: denied }, 403);

  const rows = await c
    .get("db")
    .select()
    .from(categories)
    .orderBy(asc(categories.sortOrder), asc(categories.name))
    .all();

  return c.json({
    categories: rows.map((r) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      sortOrder: r.sortOrder,
      isActive: r.isActive === 1,
    })),
  });
});

categoryRoutes.post("/", async (c) => {
  const denied = requireCookRole(c.get("user"));
  if (denied) return c.json({ error: denied }, 403);

  const body = await c.req.json<{
    code?: string;
    name?: string;
    sortOrder?: number;
  }>();
  const code = (body.code ?? "").trim().toLowerCase();
  const name = (body.name ?? "").trim();
  if (!code || !name) {
    return c.json({ error: "code と name は必須です" }, 400);
  }
  const ts = nowIso();
  const id = newId();
  try {
    await c.get("db").insert(categories).values({
      id,
      code,
      name,
      sortOrder: body.sortOrder ?? 100,
      isActive: 1,
      createdAt: ts,
      updatedAt: ts,
    });
  } catch {
    return c.json({ error: "code が重複しています" }, 409);
  }
  return c.json(
    {
      category: {
        id,
        code,
        name,
        sortOrder: body.sortOrder ?? 100,
        isActive: true,
      },
    },
    201,
  );
});

categoryRoutes.patch("/:id", async (c) => {
  const denied = requireCookRole(c.get("user"));
  if (denied) return c.json({ error: denied }, 403);

  const id = c.req.param("id");
  const body = await c.req.json<{
    name?: string;
    sortOrder?: number;
    isActive?: boolean;
  }>();
  const db = c.get("db");
  const row = await db.select().from(categories).where(eq(categories.id, id)).get();
  if (!row) return c.json({ error: "カテゴリが見つかりません" }, 404);

  const patch: Record<string, unknown> = { updatedAt: nowIso() };
  if (body.name !== undefined) patch.name = body.name.trim() || row.name;
  if (body.sortOrder !== undefined) patch.sortOrder = Math.floor(body.sortOrder);
  if (body.isActive !== undefined) patch.isActive = body.isActive ? 1 : 0;

  await db.update(categories).set(patch).where(eq(categories.id, id));
  const updated = await db.select().from(categories).where(eq(categories.id, id)).get();
  return c.json({
    category: {
      id: updated!.id,
      code: updated!.code,
      name: updated!.name,
      sortOrder: updated!.sortOrder,
      isActive: updated!.isActive === 1,
    },
  });
});
