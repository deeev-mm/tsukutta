import { Hono } from "hono";
import { and, asc, eq } from "drizzle-orm";
import { coerceIngredientLines, scaleIngredientLines } from "@tsukutta/shared";
import { recipes, shoppingListItems } from "../db/schema";
import type { AppVariables } from "../lib/auth";
import { requireAuth, requireCookRole } from "../lib/auth";
import { newId, nowIso, type Env } from "../lib/crypto";

export const shoppingListRoutes = new Hono<{
  Bindings: Env;
  Variables: AppVariables;
}>();

shoppingListRoutes.use("*", requireAuth);

function serialize(item: typeof shoppingListItems.$inferSelect) {
  return {
    id: item.id,
    name: item.name,
    sourceRecipeId: item.sourceRecipeId,
    isChecked: item.isChecked === 1,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

shoppingListRoutes.get("/", async (c) => {
  const user = c.get("user");
  const db = c.get("db");
  const rows = await db
    .select()
    .from(shoppingListItems)
    .where(eq(shoppingListItems.familyId, user.familyId))
    .orderBy(asc(shoppingListItems.isChecked), asc(shoppingListItems.createdAt))
    .all();
  return c.json({ items: rows.map(serialize) });
});

shoppingListRoutes.post("/", async (c) => {
  const user = c.get("user");
  const denied = requireCookRole(user);
  if (denied) return c.json({ error: denied }, 403);

  const db = c.get("db");
  const body = await c.req.json<{ name?: string }>();
  const name = (body.name ?? "").trim();
  if (!name) return c.json({ error: "品目名を入力してください" }, 400);

  const ts = nowIso();
  const id = newId();
  await db.insert(shoppingListItems).values({
    id,
    familyId: user.familyId,
    name,
    sourceRecipeId: null,
    isChecked: 0,
    createdAt: ts,
    updatedAt: ts,
  });
  const row = await db.select().from(shoppingListItems).where(eq(shoppingListItems.id, id)).get();
  return c.json({ item: serialize(row!) }, 201);
});

// レシピの材料をまとめて買い物リストへ追加(人前は任意。既定はレシピの標準)
shoppingListRoutes.post("/from-recipe/:recipeId", async (c) => {
  const user = c.get("user");
  const denied = requireCookRole(user);
  if (denied) return c.json({ error: denied }, 403);

  const db = c.get("db");
  const recipeId = c.req.param("recipeId");
  const body = await c.req
    .json<{ servings?: number }>()
    .catch(() => ({ servings: undefined }));

  const recipe = await db
    .select()
    .from(recipes)
    .where(and(eq(recipes.id, recipeId), eq(recipes.familyId, user.familyId)))
    .get();
  if (!recipe || recipe.isArchived === 1) {
    return c.json({ error: "レシピが見つかりません" }, 404);
  }

  const servings =
    typeof body.servings === "number" && body.servings >= 1
      ? Math.floor(body.servings)
      : (user.householdSize ?? 1);

  const ingredients = coerceIngredientLines(JSON.parse(recipe.ingredientsJson || "[]"));
  const rows = scaleIngredientLines(ingredients, servings).filter(
    (r) => !r.isSection && (r.name || r.amount),
  );

  const ts = nowIso();
  const inserted = [];
  for (const row of rows) {
    const line = [row.name, row.amount].filter(Boolean).join(" ");
    const id = newId();
    await db.insert(shoppingListItems).values({
      id,
      familyId: user.familyId,
      name: line,
      sourceRecipeId: recipe.id,
      isChecked: 0,
      createdAt: ts,
      updatedAt: ts,
    });
    inserted.push(id);
  }

  const items = await db
    .select()
    .from(shoppingListItems)
    .where(eq(shoppingListItems.familyId, user.familyId))
    .orderBy(asc(shoppingListItems.isChecked), asc(shoppingListItems.createdAt))
    .all();
  return c.json({ added: inserted.length, items: items.map(serialize) }, 201);
});

shoppingListRoutes.delete("/checked", async (c) => {
  const user = c.get("user");
  const denied = requireCookRole(user);
  if (denied) return c.json({ error: denied }, 403);

  const db = c.get("db");
  await db
    .delete(shoppingListItems)
    .where(and(eq(shoppingListItems.familyId, user.familyId), eq(shoppingListItems.isChecked, 1)));
  return c.json({ ok: true });
});

shoppingListRoutes.patch("/:id", async (c) => {
  const user = c.get("user");
  const denied = requireCookRole(user);
  if (denied) return c.json({ error: denied }, 403);

  const db = c.get("db");
  const id = c.req.param("id");
  const existing = await db
    .select()
    .from(shoppingListItems)
    .where(and(eq(shoppingListItems.id, id), eq(shoppingListItems.familyId, user.familyId)))
    .get();
  if (!existing) return c.json({ error: "品目が見つかりません" }, 404);

  const body = await c.req.json<{ name?: string; isChecked?: boolean }>();
  const patch: Record<string, unknown> = { updatedAt: nowIso() };
  if (body.name !== undefined) {
    const name = body.name.trim();
    if (!name) return c.json({ error: "品目名を入力してください" }, 400);
    patch.name = name;
  }
  if (body.isChecked !== undefined) {
    patch.isChecked = body.isChecked ? 1 : 0;
  }

  await db.update(shoppingListItems).set(patch).where(eq(shoppingListItems.id, id));
  const row = await db.select().from(shoppingListItems).where(eq(shoppingListItems.id, id)).get();
  return c.json({ item: serialize(row!) });
});

shoppingListRoutes.delete("/:id", async (c) => {
  const user = c.get("user");
  const denied = requireCookRole(user);
  if (denied) return c.json({ error: denied }, 403);

  const db = c.get("db");
  const id = c.req.param("id");
  const existing = await db
    .select()
    .from(shoppingListItems)
    .where(and(eq(shoppingListItems.id, id), eq(shoppingListItems.familyId, user.familyId)))
    .get();
  if (!existing) return c.json({ error: "品目が見つかりません" }, 404);

  await db.delete(shoppingListItems).where(eq(shoppingListItems.id, id));
  return c.json({ ok: true });
});
