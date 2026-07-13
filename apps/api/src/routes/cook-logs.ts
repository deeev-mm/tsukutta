import { Hono } from "hono";
import { and, desc, eq, gte, lte } from "drizzle-orm";
import { cookLogs, recipes } from "../db/schema";
import type { AppVariables } from "../lib/auth";
import { requireAuth, requireCookRole } from "../lib/auth";
import { newId, nowIso, todayYmd, type Env } from "../lib/crypto";

export const cookLogRoutes = new Hono<{
  Bindings: Env;
  Variables: AppVariables;
}>();

cookLogRoutes.use("*", requireAuth);

function serialize(
  log: typeof cookLogs.$inferSelect,
  recipeName?: string | null,
  imageKey?: string | null,
) {
  return {
    id: log.id,
    familyId: log.familyId,
    recipeId: log.recipeId,
    recipeName: recipeName ?? null,
    recipeImageUrl: imageKey
      ? `/api/v1/recipes/${log.recipeId}/image`
      : null,
    cookedAt: log.cookedAt,
    cookNote: log.cookNote,
    createdByUserId: log.createdByUserId,
    createdAt: log.createdAt,
    updatedAt: log.updatedAt,
  };
}

cookLogRoutes.get("/", async (c) => {
  const user = c.get("user");
  const from = c.req.query("from");
  const to = c.req.query("to");
  const recipeId = c.req.query("recipeId");
  const db = c.get("db");

  const conds = [eq(cookLogs.familyId, user.familyId)];
  if (from) conds.push(gte(cookLogs.cookedAt, from));
  if (to) conds.push(lte(cookLogs.cookedAt, to));
  if (recipeId) conds.push(eq(cookLogs.recipeId, recipeId));

  const rows = await db
    .select({
      log: cookLogs,
      recipeName: recipes.name,
      imageKey: recipes.imageKey,
    })
    .from(cookLogs)
    .innerJoin(recipes, eq(cookLogs.recipeId, recipes.id))
    .where(and(...conds))
    .orderBy(desc(cookLogs.cookedAt), desc(cookLogs.createdAt))
    .all();

  return c.json({
    cookLogs: rows.map((r) =>
      serialize(r.log, r.recipeName, r.imageKey),
    ),
  });
});

cookLogRoutes.get("/:id", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  const db = c.get("db");
  const row = await db
    .select({
      log: cookLogs,
      recipeName: recipes.name,
      imageKey: recipes.imageKey,
    })
    .from(cookLogs)
    .innerJoin(recipes, eq(cookLogs.recipeId, recipes.id))
    .where(and(eq(cookLogs.id, id), eq(cookLogs.familyId, user.familyId)))
    .get();
  if (!row) return c.json({ error: "記録が見つかりません" }, 404);
  return c.json({
    cookLog: serialize(row.log, row.recipeName, row.imageKey),
  });
});

cookLogRoutes.post("/", async (c) => {
  const user = c.get("user");
  const denied = requireCookRole(user);
  if (denied) return c.json({ error: denied }, 403);

  const body = await c.req.json<{
    recipeId?: string;
    cookedAt?: string;
    cookNote?: string | null;
  }>();

  const recipeId = body.recipeId?.trim();
  if (!recipeId) return c.json({ error: "レシピを指定してください" }, 400);

  const cookedAt = (body.cookedAt ?? todayYmd()).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(cookedAt)) {
    return c.json({ error: "日付は YYYY-MM-DD 形式で入力してください" }, 400);
  }

  const db = c.get("db");
  const recipe = await db
    .select()
    .from(recipes)
    .where(
      and(
        eq(recipes.id, recipeId),
        eq(recipes.familyId, user.familyId),
        eq(recipes.isArchived, 0),
      ),
    )
    .get();
  if (!recipe) return c.json({ error: "レシピが見つかりません" }, 404);

  const ts = nowIso();
  const id = newId();
  await db.insert(cookLogs).values({
    id,
    familyId: user.familyId,
    recipeId,
    cookedAt,
    cookNote: body.cookNote?.trim() || null,
    createdByUserId: user.id,
    createdAt: ts,
    updatedAt: ts,
  });

  return c.json(
    {
      cookLog: serialize(
        {
          id,
          familyId: user.familyId,
          recipeId,
          cookedAt,
          cookNote: body.cookNote?.trim() || null,
          createdByUserId: user.id,
          createdAt: ts,
          updatedAt: ts,
        },
        recipe.name,
        recipe.imageKey,
      ),
    },
    201,
  );
});

cookLogRoutes.patch("/:id", async (c) => {
  const user = c.get("user");
  const denied = requireCookRole(user);
  if (denied) return c.json({ error: denied }, 403);

  const id = c.req.param("id");
  const db = c.get("db");
  const existing = await db
    .select()
    .from(cookLogs)
    .where(and(eq(cookLogs.id, id), eq(cookLogs.familyId, user.familyId)))
    .get();
  if (!existing) return c.json({ error: "記録が見つかりません" }, 404);

  const body = await c.req.json<{
    cookedAt?: string;
    cookNote?: string | null;
  }>();

  const patch: {
    cookedAt?: string;
    cookNote?: string | null;
    updatedAt: string;
  } = { updatedAt: nowIso() };

  if (body.cookedAt !== undefined) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(body.cookedAt)) {
      return c.json({ error: "日付は YYYY-MM-DD 形式で入力してください" }, 400);
    }
    patch.cookedAt = body.cookedAt;
  }
  if (body.cookNote !== undefined) {
    patch.cookNote = body.cookNote?.trim() || null;
  }

  await db.update(cookLogs).set(patch).where(eq(cookLogs.id, id));

  const row = await db
    .select({
      log: cookLogs,
      recipeName: recipes.name,
      imageKey: recipes.imageKey,
    })
    .from(cookLogs)
    .innerJoin(recipes, eq(cookLogs.recipeId, recipes.id))
    .where(eq(cookLogs.id, id))
    .get();

  return c.json({
    cookLog: serialize(row!.log, row!.recipeName, row!.imageKey),
  });
});

cookLogRoutes.delete("/:id", async (c) => {
  const user = c.get("user");
  const denied = requireCookRole(user);
  if (denied) return c.json({ error: denied }, 403);

  const id = c.req.param("id");
  const db = c.get("db");
  const existing = await db
    .select()
    .from(cookLogs)
    .where(and(eq(cookLogs.id, id), eq(cookLogs.familyId, user.familyId)))
    .get();
  if (!existing) return c.json({ error: "記録が見つかりません" }, 404);

  await db.delete(cookLogs).where(eq(cookLogs.id, id));
  return c.json({ ok: true });
});
