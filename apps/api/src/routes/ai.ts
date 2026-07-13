import { Hono } from "hono";
import type { AppVariables } from "../lib/auth";
import { requireAuth, requireCookRole } from "../lib/auth";
import { formatRecipeWithGroq } from "../lib/groq";
import type { Env } from "../lib/crypto";

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
