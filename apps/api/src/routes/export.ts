import { Hono } from "hono";
import { eq } from "drizzle-orm";
import {
  categories,
  cookLogRatings,
  cookLogs,
  families,
  recipeCategories,
  recipes,
} from "../db/schema";
import type { AppVariables } from "../lib/auth";
import { requireAuth } from "../lib/auth";
import { parseJsonArray, type Env } from "../lib/crypto";

export const exportRoutes = new Hono<{
  Bindings: Env;
  Variables: AppVariables;
}>();

exportRoutes.use("*", requireAuth);

/**
 * GET /export — 家族データをまるごとJSONで書き出す(バックアップ用)。
 * 画像本体(R2)は含まない。imageUrl から別途保存する想定。
 */
exportRoutes.get("/", async (c) => {
  const user = c.get("user");
  const db = c.get("db");

  const family = await db
    .select()
    .from(families)
    .where(eq(families.id, user.familyId))
    .get();

  const recipeRows = await db
    .select()
    .from(recipes)
    .where(eq(recipes.familyId, user.familyId))
    .all();

  const recipeCatRows = await db
    .select({
      recipeId: recipeCategories.recipeId,
      categoryCode: categories.code,
      categoryName: categories.name,
    })
    .from(recipeCategories)
    .innerJoin(categories, eq(recipeCategories.categoryId, categories.id))
    .all();
  const catByRecipe = new Map<string, Array<{ code: string; name: string }>>();
  for (const row of recipeCatRows) {
    const arr = catByRecipe.get(row.recipeId) ?? [];
    arr.push({ code: row.categoryCode, name: row.categoryName });
    catByRecipe.set(row.recipeId, arr);
  }

  const cookLogRows = await db
    .select()
    .from(cookLogs)
    .where(eq(cookLogs.familyId, user.familyId))
    .all();

  const cookLogIds = cookLogRows.map((l) => l.id);
  const ratingRows = cookLogIds.length
    ? await db.select().from(cookLogRatings).all()
    : [];
  const ratingsByLog = new Map<string, typeof ratingRows>();
  for (const r of ratingRows) {
    if (!cookLogIds.includes(r.cookLogId)) continue;
    const arr = ratingsByLog.get(r.cookLogId) ?? [];
    arr.push(r);
    ratingsByLog.set(r.cookLogId, arr);
  }

  const body = {
    exportedAt: new Date().toISOString(),
    format: "tsukutta.backup.v1",
    family: family
      ? {
          name: family.name,
          householdSize: family.householdSize,
        }
      : null,
    recipes: recipeRows.map((r) => ({
      id: r.id,
      name: r.name,
      sourceUrl: r.sourceUrl,
      ingredients: parseJsonArray(r.ingredientsJson),
      instructions: parseJsonArray(r.instructionsJson),
      sourceServings: r.sourceServings,
      servingsLabel: r.servingsLabel,
      notes: r.notes,
      tags: parseJsonArray(r.tagsJson),
      categories: catByRecipe.get(r.id) ?? [],
      isHallOfFame: r.isHallOfFame === 1,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    })),
    cookLogs: cookLogRows.map((l) => ({
      id: l.id,
      recipeId: l.recipeId,
      cookedAt: l.cookedAt,
      cookNote: l.cookNote,
      ratings: (ratingsByLog.get(l.id) ?? []).map((r) => ({
        rating: r.rating,
        comment: r.comment,
      })),
      createdAt: l.createdAt,
    })),
  };

  const filename = `tsukutta-backup-${new Date().toISOString().slice(0, 10)}.json`;
  return new Response(JSON.stringify(body, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
});
