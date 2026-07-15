import { Hono } from "hono";
import { desc, eq } from "drizzle-orm";
import type { AppVariables } from "../lib/auth";
import { requireAuth, requireCookRole } from "../lib/auth";
import { formatRecipeWithGroq, pickRecommendationWithGroq } from "../lib/groq";
import type { Env } from "../lib/crypto";
import { cookLogs, recipes } from "../db/schema";
import { computeRecommendations } from "./rankings";

export const aiRoutes = new Hono<{ Bindings: Env; Variables: AppVariables }>();

aiRoutes.use("*", requireAuth);

aiRoutes.post("/format", async (c) => {
  const user = c.get("user");
  const denied = requireCookRole(user);
  if (denied) return c.json({ error: denied }, 403);

  const body = await c.req.json<{
    rawText?: string;
    sourceUrl?: string | null;
    clientApiKey?: string | null;
  }>();

  const rawText = (body.rawText ?? "").trim();
  if (!rawText) {
    return c.json({ error: "レシピ本文を入力してください" }, 400);
  }
  if (rawText.length > 20000) {
    return c.json({ error: "本文が長すぎます（2万文字以内）" }, 400);
  }

  // デモ / 実運用ともクライアントの localStorage キーを都度送信（サーバーに永続保存しない）
  const apiKey =
    body.clientApiKey?.trim() ||
    c.req.header("X-Groq-Api-Key")?.trim() ||
    undefined;

  if (!apiKey) {
    return c.json(
      {
        error: "Groq APIキーが未設定です。設定画面でキーを登録してください",
        code: "GROQ_KEY_MISSING",
      },
      400,
    );
  }

  try {
    const result = await formatRecipeWithGroq(apiKey, rawText, body.sourceUrl);
    return c.json({ result });
  } catch (e) {
    if (e && typeof e === "object" && "status" in e && "message" in e) {
      const err = e as { status: number; message: string; code?: string };
      return c.json(
        { error: err.message, code: err.code },
        err.status === 429 ? 429 : 502,
      );
    }
    const message = e instanceof Error ? e.message : "AI整形に失敗しました";
    return c.json({ error: message }, 502);
  }
});

/**
 * POST /recommend — ユーザーが明示的に押したときだけ呼ぶ「AIにおすすめを聞く」機能。
 * 無料枠のトークン消費を抑えるため、自動では呼ばない。
 * ルールベースの候補プール(上位8件)＋直近の調理履歴だけをGroqに渡し、1件選んでもらう。
 */
aiRoutes.post("/recommend", async (c) => {
  const user = c.get("user");
  const denied = requireCookRole(user);
  if (denied) return c.json({ error: denied }, 403);

  const db = c.get("db");

  const body = await c.req.json<{ clientApiKey?: string | null }>();
  const apiKey =
    body.clientApiKey?.trim() || c.req.header("X-Groq-Api-Key")?.trim() || undefined;
  if (!apiKey) {
    return c.json(
      {
        error: "Groq APIキーが未設定です。設定画面でキーを登録してください",
        code: "GROQ_KEY_MISSING",
      },
      400,
    );
  }

  const candidates = await computeRecommendations(db, user.familyId, 8);
  if (candidates.length === 0) {
    return c.json(
      { error: "おすすめできるレシピがまだありません。まずは「作った」を記録してみてください" },
      400,
    );
  }

  const recentLogRows = await db
    .select({ recipeName: recipes.name, cookedAt: cookLogs.cookedAt })
    .from(cookLogs)
    .innerJoin(recipes, eq(cookLogs.recipeId, recipes.id))
    .where(eq(cookLogs.familyId, user.familyId))
    .orderBy(desc(cookLogs.cookedAt))
    .limit(10)
    .all();

  try {
    const picked = await pickRecommendationWithGroq(
      apiKey,
      candidates.map((r) => ({
        recipeId: r.recipeId,
        name: r.name,
        cookCount: r.cookCount,
        avgRating: r.avgRating,
        daysSinceLastCooked: r.daysSinceLastCooked,
        isHallOfFame: r.isHallOfFame,
      })),
      recentLogRows,
    );

    const match = candidates.find((cand) => cand.recipeId === picked.recipeId);
    if (!match) {
      // AIが候補外を返した場合はスコア1位にフォールバック
      const fallback = candidates[0];
      return c.json({
        recommendation: { ...fallback, comment: picked.comment || fallback.reason },
      });
    }

    return c.json({ recommendation: { ...match, comment: picked.comment || match.reason } });
  } catch (e) {
    if (e && typeof e === "object" && "status" in e && "message" in e) {
      const err = e as { status: number; message: string; code?: string };
      return c.json(
        { error: err.message, code: err.code },
        err.status === 429 ? 429 : 502,
      );
    }
    const message = e instanceof Error ? e.message : "AIおすすめの取得に失敗しました";
    return c.json({ error: message }, 502);
  }
});
