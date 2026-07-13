import { Hono } from "hono";
import { and, desc, eq, like } from "drizzle-orm";
import { normalizeIngredientsToOneServing } from "@pf08/shared";
import { cookLogs, recipes } from "../db/schema";
import type { AppVariables } from "../lib/auth";
import { requireAuth, requireCookRole } from "../lib/auth";
import { newId, nowIso, parseJsonArray, type Env } from "../lib/crypto";

export const recipeRoutes = new Hono<{
  Bindings: Env;
  Variables: AppVariables;
}>();

recipeRoutes.use("*", requireAuth);

function serializeRecipe(r: typeof recipes.$inferSelect) {
  return {
    id: r.id,
    familyId: r.familyId,
    name: r.name,
    sourceUrl: r.sourceUrl,
    ingredients: parseJsonArray(r.ingredientsJson),
    instructions: parseJsonArray(r.instructionsJson),
    sourceServings: r.sourceServings,
    servingsLabel: r.servingsLabel,
    notes: r.notes,
    imageKey: r.imageKey,
    imageUrl: r.imageKey ? `/api/v1/recipes/${r.id}/image` : null,
    tags: parseJsonArray(r.tagsJson),
    isHallOfFame: r.isHallOfFame === 1,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

recipeRoutes.get("/", async (c) => {
  const user = c.get("user");
  const q = (c.req.query("q") ?? "").trim();
  const db = c.get("db");

  const conds = [
    eq(recipes.familyId, user.familyId),
    eq(recipes.isArchived, 0),
  ];
  if (q) {
    conds.push(like(recipes.name, `%${q}%`));
  }

  const rows = await db
    .select()
    .from(recipes)
    .where(and(...conds))
    .orderBy(desc(recipes.updatedAt))
    .all();

  return c.json({ recipes: rows.map(serializeRecipe) });
});

recipeRoutes.get("/:id", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  const db = c.get("db");
  const row = await db
    .select()
    .from(recipes)
    .where(and(eq(recipes.id, id), eq(recipes.familyId, user.familyId)))
    .get();
  if (!row || row.isArchived === 1) {
    return c.json({ error: "レシピが見つかりません" }, 404);
  }
  return c.json({ recipe: serializeRecipe(row) });
});

recipeRoutes.post("/", async (c) => {
  const user = c.get("user");
  const denied = requireCookRole(user);
  if (denied) return c.json({ error: denied }, 403);

  const body = await c.req.json<{
    name?: string;
    sourceUrl?: string | null;
    ingredients?: string[];
    instructions?: string[];
    sourceServings?: number | null;
    servingsLabel?: string | null;
    notes?: string | null;
    tags?: string[];
  }>();

  const name = (body.name ?? "").trim();
  if (!name) return c.json({ error: "料理名は必須です" }, 400);

  const sourceServings =
    typeof body.sourceServings === "number" && body.sourceServings >= 1
      ? Math.floor(body.sourceServings)
      : 1;

  const ingredients = normalizeIngredientsToOneServing(
    (body.ingredients ?? []).map(String).map((s) => s.trim()).filter(Boolean),
    sourceServings,
  );
  const instructions = (body.instructions ?? [])
    .map(String)
    .map((s) => s.trim())
    .filter(Boolean);

  const ts = nowIso();
  const id = newId();
  const db = c.get("db");

  await db.insert(recipes).values({
    id,
    familyId: user.familyId,
    name,
    sourceUrl: body.sourceUrl?.trim() || null,
    ingredientsJson: JSON.stringify(ingredients),
    instructionsJson: JSON.stringify(instructions),
    sourceServings,
    servingsLabel: body.servingsLabel?.trim() || null,
    notes: body.notes?.trim() || null,
    imageKey: null,
    tagsJson: JSON.stringify(body.tags ?? []),
    isHallOfFame: 0,
    isArchived: 0,
    createdAt: ts,
    updatedAt: ts,
  });

  const row = await db.select().from(recipes).where(eq(recipes.id, id)).get();
  return c.json({ recipe: serializeRecipe(row!) }, 201);
});

recipeRoutes.patch("/:id", async (c) => {
  const user = c.get("user");
  const denied = requireCookRole(user);
  if (denied) return c.json({ error: denied }, 403);

  const id = c.req.param("id");
  const db = c.get("db");
  const existing = await db
    .select()
    .from(recipes)
    .where(and(eq(recipes.id, id), eq(recipes.familyId, user.familyId)))
    .get();
  if (!existing || existing.isArchived === 1) {
    return c.json({ error: "レシピが見つかりません" }, 404);
  }

  const body = await c.req.json<{
    name?: string;
    sourceUrl?: string | null;
    ingredients?: string[];
    instructions?: string[];
    sourceServings?: number | null;
    servingsLabel?: string | null;
    notes?: string | null;
    tags?: string[];
    clearImage?: boolean;
  }>();

  const patch: Record<string, unknown> = { updatedAt: nowIso() };

  if (body.name !== undefined) {
    const name = body.name.trim();
    if (!name) return c.json({ error: "料理名は必須です" }, 400);
    patch.name = name;
  }
  if (body.sourceUrl !== undefined) {
    patch.sourceUrl = body.sourceUrl?.trim() || null;
  }
  if (body.servingsLabel !== undefined) {
    patch.servingsLabel = body.servingsLabel?.trim() || null;
  }
  if (body.notes !== undefined) {
    patch.notes = body.notes?.trim() || null;
  }
  if (body.tags !== undefined) {
    patch.tagsJson = JSON.stringify(body.tags);
  }
  if (body.clearImage) {
    if (existing.imageKey) {
      try {
        await c.env.IMAGES.delete(existing.imageKey);
      } catch {
        /* ignore */
      }
    }
    patch.imageKey = null;
  }

  if (body.ingredients !== undefined || body.sourceServings !== undefined) {
    const sourceServings =
      typeof body.sourceServings === "number" && body.sourceServings >= 1
        ? Math.floor(body.sourceServings)
        : existing.sourceServings ?? 1;
    const rawIngredients =
      body.ingredients !== undefined
        ? body.ingredients.map(String).map((s) => s.trim()).filter(Boolean)
        : parseJsonArray(existing.ingredientsJson);
    patch.ingredientsJson = JSON.stringify(
      normalizeIngredientsToOneServing(rawIngredients, sourceServings),
    );
    patch.sourceServings = sourceServings;
  }

  if (body.instructions !== undefined) {
    patch.instructionsJson = JSON.stringify(
      body.instructions.map(String).map((s) => s.trim()).filter(Boolean),
    );
  }

  await db.update(recipes).set(patch).where(eq(recipes.id, id));
  const row = await db.select().from(recipes).where(eq(recipes.id, id)).get();
  return c.json({ recipe: serializeRecipe(row!) });
});

recipeRoutes.delete("/:id", async (c) => {
  const user = c.get("user");
  const denied = requireCookRole(user);
  if (denied) return c.json({ error: denied }, 403);

  const id = c.req.param("id");
  const db = c.get("db");
  const existing = await db
    .select()
    .from(recipes)
    .where(and(eq(recipes.id, id), eq(recipes.familyId, user.familyId)))
    .get();
  if (!existing) return c.json({ error: "レシピが見つかりません" }, 404);

  const log = await db
    .select({ id: cookLogs.id })
    .from(cookLogs)
    .where(eq(cookLogs.recipeId, id))
    .get();

  if (log) {
    await db
      .update(recipes)
      .set({ isArchived: 1, updatedAt: nowIso() })
      .where(eq(recipes.id, id));
    return c.json({ ok: true, archived: true });
  }

  if (existing.imageKey) {
    try {
      await c.env.IMAGES.delete(existing.imageKey);
    } catch {
      /* ignore */
    }
  }
  await db.delete(recipes).where(eq(recipes.id, id));
  return c.json({ ok: true, archived: false });
});

recipeRoutes.post("/:id/image", async (c) => {
  const user = c.get("user");
  const denied = requireCookRole(user);
  if (denied) return c.json({ error: denied }, 403);

  const id = c.req.param("id");
  const db = c.get("db");
  const existing = await db
    .select()
    .from(recipes)
    .where(and(eq(recipes.id, id), eq(recipes.familyId, user.familyId)))
    .get();
  if (!existing || existing.isArchived === 1) {
    return c.json({ error: "レシピが見つかりません" }, 404);
  }

  const form = await c.req.parseBody();
  const file = form.file;
  if (!file || !(file instanceof File)) {
    return c.json({ error: "画像ファイルを送信してください" }, 400);
  }
  if (!file.type.startsWith("image/")) {
    return c.json({ error: "画像ファイルのみアップロードできます" }, 400);
  }
  if (file.size > 5 * 1024 * 1024) {
    return c.json({ error: "画像は5MB以下にしてください" }, 400);
  }

  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const key = `families/${user.familyId}/recipes/${id}.${ext}`;

  if (existing.imageKey && existing.imageKey !== key) {
    try {
      await c.env.IMAGES.delete(existing.imageKey);
    } catch {
      /* ignore */
    }
  }

  await c.env.IMAGES.put(key, await file.arrayBuffer(), {
    httpMetadata: { contentType: file.type },
  });

  await db
    .update(recipes)
    .set({ imageKey: key, updatedAt: nowIso() })
    .where(eq(recipes.id, id));

  const row = await db.select().from(recipes).where(eq(recipes.id, id)).get();
  return c.json({ recipe: serializeRecipe(row!) });
});

recipeRoutes.get("/:id/image", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  const db = c.get("db");
  const existing = await db
    .select()
    .from(recipes)
    .where(and(eq(recipes.id, id), eq(recipes.familyId, user.familyId)))
    .get();
  if (!existing?.imageKey) return c.json({ error: "画像がありません" }, 404);

  const obj = await c.env.IMAGES.get(existing.imageKey);
  if (!obj) return c.json({ error: "画像がありません" }, 404);

  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set("Cache-Control", "private, max-age=3600");
  return new Response(obj.body, { headers });
});
