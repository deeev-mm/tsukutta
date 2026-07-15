import { Hono } from "hono";
import { and, desc, eq, sql } from "drizzle-orm";
import {
  categories,
  cookLogRatings,
  cookLogs,
  recipeCategories,
  recipes,
} from "../db/schema";
import type { AppVariables } from "../lib/auth";
import { requireAuth } from "../lib/auth";
import type { Env } from "../lib/crypto";

export const rankingRoutes = new Hono<{
  Bindings: Env;
  Variables: AppVariables;
}>();

rankingRoutes.use("*", requireAuth);

type RankRow = {
  recipeId: string;
  name: string;
  imageKey: string | null;
  isHallOfFame: number;
  cookCount: number;
  ratingSum: number | null;
  ratingCount: number;
  lastCookedAt: string | null;
};

function toEntry(r: RankRow, rank: number) {
  const avgRating =
    r.ratingCount > 0 && r.ratingSum != null
      ? Math.round((r.ratingSum / r.ratingCount) * 10) / 10
      : null;
  return {
    rank,
    recipeId: r.recipeId,
    name: r.name,
    imageUrl: r.imageKey ? `/api/v1/recipes/${r.recipeId}/image` : null,
    isHallOfFame: r.isHallOfFame === 1,
    cookCount: r.cookCount,
    avgRating,
    ratingCount: r.ratingCount,
    lastCookedAt: r.lastCookedAt,
  };
}

async function loadRankingRows(
  db: ReturnType<typeof import("../db/client").createDb>,
  familyId: string,
  categoryId?: string,
): Promise<RankRow[]> {
  // D1/SQLite: aggregate cook counts + rating averages per recipe in family
  if (categoryId) {
    const rows = await db
      .select({
        recipeId: recipes.id,
        name: recipes.name,
        imageKey: recipes.imageKey,
        isHallOfFame: recipes.isHallOfFame,
        cookCount: sql<number>`count(distinct ${cookLogs.id})`.mapWith(Number),
        ratingSum: sql<number | null>`sum(${cookLogRatings.rating})`.mapWith(
          (v) => (v == null ? null : Number(v)),
        ),
        ratingCount: sql<number>`count(${cookLogRatings.rating})`.mapWith(Number),
        lastCookedAt: sql<string | null>`max(${cookLogs.cookedAt})`,
      })
      .from(recipes)
      .innerJoin(
        recipeCategories,
        and(
          eq(recipeCategories.recipeId, recipes.id),
          eq(recipeCategories.categoryId, categoryId),
        ),
      )
      .leftJoin(cookLogs, eq(cookLogs.recipeId, recipes.id))
      .leftJoin(cookLogRatings, eq(cookLogRatings.cookLogId, cookLogs.id))
      .where(
        and(
          eq(recipes.familyId, familyId),
          eq(recipes.isArchived, 0),
        ),
      )
      .groupBy(recipes.id)
      .having(sql`count(distinct ${cookLogs.id}) > 0`)
      .orderBy(
        desc(sql`count(distinct ${cookLogs.id})`),
        desc(sql`avg(${cookLogRatings.rating})`),
        recipes.name,
      )
      .all();
    return rows;
  }

  const rows = await db
    .select({
      recipeId: recipes.id,
      name: recipes.name,
      imageKey: recipes.imageKey,
      isHallOfFame: recipes.isHallOfFame,
      cookCount: sql<number>`count(distinct ${cookLogs.id})`.mapWith(Number),
      ratingSum: sql<number | null>`sum(${cookLogRatings.rating})`.mapWith(
        (v) => (v == null ? null : Number(v)),
      ),
      ratingCount: sql<number>`count(${cookLogRatings.rating})`.mapWith(Number),
      lastCookedAt: sql<string | null>`max(${cookLogs.cookedAt})`,
    })
    .from(recipes)
    .leftJoin(cookLogs, eq(cookLogs.recipeId, recipes.id))
    .leftJoin(cookLogRatings, eq(cookLogRatings.cookLogId, cookLogs.id))
    .where(and(eq(recipes.familyId, familyId), eq(recipes.isArchived, 0)))
    .groupBy(recipes.id)
    .having(sql`count(distinct ${cookLogs.id}) > 0`)
    .orderBy(
      desc(sql`count(distinct ${cookLogs.id})`),
      desc(sql`avg(${cookLogRatings.rating})`),
      recipes.name,
    )
    .all();
  return rows;
}

/** GET /rankings?categoryId= — 家族スコープ。作った回数↓、平均★↓ */
rankingRoutes.get("/", async (c) => {
  const user = c.get("user");
  const categoryId = (c.req.query("categoryId") ?? "").trim() || undefined;
  const db = c.get("db");

  if (categoryId) {
    const cat = await db
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.id, categoryId))
      .get();
    if (!cat) return c.json({ error: "カテゴリが見つかりません" }, 404);
  }

  const rows = await loadRankingRows(db, user.familyId, categoryId);
  return c.json({
    rankings: rows.map((r, i) => toEntry(r, i + 1)),
    categoryId: categoryId ?? null,
  });
});

/** ルールベースの「また作る」候補算出。AIおすすめ機能の候補プールとしても再利用する。 */
export async function computeRecommendations(
  db: ReturnType<typeof import("../db/client").createDb>,
  familyId: string,
  limit: number,
) {
  const rows = await loadRankingRows(db, familyId);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const scored = rows.map((r) => {
    const avg =
      r.ratingCount > 0 && r.ratingSum != null
        ? r.ratingSum / r.ratingCount
        : 0;
    const hof = r.isHallOfFame === 1 ? 3 : 0;
    const cookBonus = Math.min(r.cookCount, 5);
    let daysSince = 365;
    if (r.lastCookedAt) {
      const last = new Date(`${r.lastCookedAt}T00:00:00`);
      daysSince = Math.max(
        0,
        Math.floor((today.getTime() - last.getTime()) / 86400000),
      );
    }
    // 最近7日以内は減点、14日以上空いていると加点
    const recency =
      daysSince <= 7 ? -4 : daysSince >= 14 ? Math.min(daysSince / 7, 4) : 0;
    const score = avg * 2 + cookBonus + hof + recency;
    return { row: r, score, daysSince };
  });

  scored.sort((a, b) => b.score - a.score || b.row.cookCount - a.row.cookCount);

  return scored.slice(0, limit).map((s, i) => ({
    ...toEntry(s.row, i + 1),
    score: Math.round(s.score * 10) / 10,
    daysSinceLastCooked: s.daysSince,
    reason:
      s.row.isHallOfFame === 1
        ? "殿堂入り"
        : s.row.ratingCount > 0 && (s.row.ratingSum ?? 0) / s.row.ratingCount >= 4
          ? "家族の評価が高い"
          : s.daysSince >= 14
            ? "しばらく作っていない"
            : "よく作っている定番",
  }));
}

/**
 * GET /recommendations — 「また作る」候補
 * 高評価・殿堂・作った回数を加点し、最近作ったものは減点。
 */
rankingRoutes.get("/recommendations", async (c) => {
  const user = c.get("user");
  const db = c.get("db");
  const limit = Math.min(10, Math.max(1, Number(c.req.query("limit")) || 5));
  const recommendations = await computeRecommendations(db, user.familyId, limit);
  return c.json({ recommendations });
});
