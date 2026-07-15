import type { AiFormatResult } from "@tsukutta/shared";

const SYSTEM = `あなたは家庭料理のレシピ整形アシスタントです。
ユーザーがコピペした雑なレシピ本文（サイトのフッターやレビューが混ざっていてもよい）から、料理の本体だけを抜き出して、次のJSONオブジェクトだけを出力してください。
{
  "name": "料理名",
  "sourceServings": 人数（数値。不明なら null）,
  "ingredients": ["材料 分量", "..."],
  "instructions": ["手順1", "..."],
  "notes": "定番メモ。なければ空文字"
}
ルール:
- レビュー・関連レシピ・広告・会社案内・ナビ・Play Video は無視する
- 不明な項目は捏造せず空文字・空配列・nullにする
- ingredients / instructions は文字列配列。材料は分量付きで1行ずつ
- sourceServings は「何人分」から読み取る。不明なら null
- notes はポイント等の一言。なければ空文字
- JSON以外は出力しない`;

/** Groq 無料枠で使いやすい高速モデル */
const GROQ_MODEL = "llama-3.1-8b-instant";

export class GroqApiError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export async function formatRecipeWithGroq(
  apiKey: string,
  rawText: string,
  sourceUrl?: string | null,
): Promise<AiFormatResult> {
  const userContent = [
    sourceUrl ? `出典URL（参考）: ${sourceUrl}` : null,
    "以下のコピペ本文からレシピ本体だけを整形してください:",
    rawText,
  ]
    .filter(Boolean)
    .join("\n\n");

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: userContent },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw mapGroqHttpError(res.status, body);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error("Groqから有効な応答がありませんでした");

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("AI出力のJSONパースに失敗しました");
  }

  return normalizeAiResult(parsed);
}

function mapGroqHttpError(status: number, body: string): GroqApiError {
  if (status === 429) {
    return new GroqApiError(
      "Groq の利用枠（レート制限）を超えました。しばらく待って再試行してください。材料・手順だけ貼ると消費も抑えられます。",
      429,
      "GROQ_QUOTA",
    );
  }
  if (status === 401 || /invalid.?api.?key|Incorrect API key/i.test(body)) {
    return new GroqApiError(
      "Groq APIキーが無効です。設定画面でキーを見直してください。",
      401,
      "GROQ_KEY_INVALID",
    );
  }
  if (status === 403) {
    return new GroqApiError(
      "Groq APIへのアクセスが拒否されました。APIキーの権限を確認してください。",
      403,
      "GROQ_FORBIDDEN",
    );
  }
  return new GroqApiError(
    `Groq APIエラー (${status}): ${body.slice(0, 160)}`,
    status,
  );
}

function normalizeAiResult(raw: unknown): AiFormatResult {
  if (!raw || typeof raw !== "object") {
    throw new Error("AI出力の形式が不正です");
  }
  const o = raw as Record<string, unknown>;
  const name = String(o.name ?? "").trim();
  if (!name) throw new Error("料理名を抽出できませんでした");

  const ingredients = Array.isArray(o.ingredients)
    ? o.ingredients.map(String).map((s) => s.trim()).filter(Boolean)
    : [];
  const instructions = Array.isArray(o.instructions)
    ? o.instructions.map(String).map((s) => s.trim()).filter(Boolean)
    : [];

  let sourceServings: number | null = null;
  if (typeof o.sourceServings === "number" && o.sourceServings >= 1) {
    sourceServings = Math.round(o.sourceServings);
  }

  return {
    name,
    sourceServings,
    ingredients,
    instructions,
    notes: String(o.notes ?? "").trim(),
  };
}
