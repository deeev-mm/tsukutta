export type UserRole = "owner" | "cook" | "reviewer";

export type AiFormatResult = {
  name: string;
  sourceServings: number | null;
  ingredients: string[];
  instructions: string[];
  notes: string;
};

export type SessionUser = {
  id: string;
  familyId: string;
  loginId: string;
  displayName: string;
  role: UserRole;
  isDemo: boolean;
  householdSize: number;
  familyName: string | null;
};

export type IngredientRow = {
  kind: "item" | "section";
  name: string;
  amount: string;
};

export const GROQ_STORAGE_KEY = "pf08.groqApiKey";

/** Groq Console で APIキーを発行するページ */
export const GROQ_API_KEY_URL = "https://console.groq.com/keys";

export const MIN_PASSWORD_LENGTH = 4;

/** 分数を先にマッチ（`1/4` を `1` と誤認しない） */
const QTY = "(\\d+\\/\\d+|\\d+(?:\\.\\d+)?|½|⅓|⅔|¼|¾)";

/** 材料行の数量に倍率を掛ける。取れなければ原文のまま */
export function scaleIngredientLine(line: string, factor: number): string {
  if (!Number.isFinite(factor) || factor === 1 || factor <= 0) return line;

  // 「1と1/2」「大さじ1と1/2」をまとめて換算
  const mixed = line.match(
    new RegExp(`(^|[^\\d])(\\d+)\\s*と\\s*(${QTY.slice(1, -1)})`),
  );
  if (mixed && mixed.index != null) {
    const whole = Number(mixed[2]);
    const frac = parseQuantity(mixed[3]);
    if (frac != null) {
      const scaled = roundQuantity((whole + frac) * factor);
      const start = mixed.index + mixed[1].length;
      const end = start + mixed[0].length - mixed[1].length;
      return `${line.slice(0, start)}${formatQuantity(scaled)}${line.slice(end)}`;
    }
  }

  const re = new RegExp(QTY);
  const match = line.match(re);
  if (!match || match.index == null) return line;

  const rawNum = match[0];
  const n = parseQuantity(rawNum);
  if (n == null) return line;

  const scaled = roundQuantity(n * factor);
  const start = match.index;
  const end = start + rawNum.length;
  return `${line.slice(0, start)}${formatQuantity(scaled)}${line.slice(end)}`;
}

export function normalizeIngredientsToOneServing(
  ingredients: string[],
  sourceServings: number,
): string[] {
  if (!Number.isFinite(sourceServings) || sourceServings <= 1) {
    return ingredients;
  }
  return ingredients.map((line) =>
    scaleIngredientLine(line, 1 / sourceServings),
  );
}

export function scaleIngredients(
  ingredients: string[],
  displayServings: number,
): string[] {
  if (!Number.isFinite(displayServings) || displayServings <= 0) {
    return ingredients;
  }
  return ingredients.map((line) => scaleIngredientLine(line, displayServings));
}

/**
 * 材料リストを「材料名 / 使用量」行に整形。
 * AIが「材料名」「分量」を交互に出したケースも吸収する。
 */
export function toIngredientRows(ingredients: string[]): IngredientRow[] {
  const rows: IngredientRow[] = [];
  const lines = ingredients.map((s) => s.trim()).filter(Boolean);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const next = lines[i + 1];

    if (isSectionHeader(line)) {
      rows.push({ kind: "section", name: line, amount: "" });
      continue;
    }

    // 交互行: 「ごはん」+「どんぶり1杯(200g)」
    if (
      next &&
      !isSectionHeader(next) &&
      !looksLikeAmountOnly(line) &&
      looksLikeAmountOnly(next)
    ) {
      rows.push({ kind: "item", name: line, amount: next });
      i += 1;
      continue;
    }

    const split = splitNameAmount(line);
    rows.push({ kind: "item", name: split.name, amount: split.amount });
  }

  return rows;
}

/** 表示用人前で使用量だけ換算した行 */
export function scaleIngredientRows(
  ingredients: string[],
  displayServings: number,
): IngredientRow[] {
  const factor =
    Number.isFinite(displayServings) && displayServings > 0
      ? displayServings
      : 1;
  return toIngredientRows(ingredients).map((row) => {
    if (row.kind === "section") return row;
    return {
      ...row,
      amount: row.amount ? scaleIngredientLine(row.amount, factor) : "",
    };
  });
}

function isSectionHeader(line: string): boolean {
  if (/^[☆★■●【]/.test(line)) return true;
  if (/^(仕上げ用|調味料|材料)/.test(line) && !hasQuantity(line)) return true;
  return false;
}

function hasQuantity(line: string): boolean {
  return new RegExp(QTY).test(line);
}

function looksLikeAmountOnly(line: string): boolean {
  if (/^(適量|少々|お好み|ひとつまみ)/.test(line)) return true;
  if (/^(大さじ|小さじ|カップ|どんぶり)/.test(line)) return true;
  // 「2個」「200g」「1/4個(50g)」など、先頭が数量
  if (new RegExp(`^${QTY}`).test(line)) return true;
  return false;
}

function splitNameAmount(line: string): { name: string; amount: string } {
  // 「豚肉 200g」「玉ねぎ 1/4個(50g)」
  const spaced = line.match(
    new RegExp(
      `^(.+?)\\s+((?:大さじ|小さじ|カップ|どんぶり)?\\s*${QTY}.*|適量.*|少々.*|お好み.*)$`,
    ),
  );
  if (spaced) {
    return { name: spaced[1].trim(), amount: spaced[2].trim() };
  }

  // 「大さじ1」「適量」だけ
  if (looksLikeAmountOnly(line)) {
    return { name: "", amount: line };
  }

  // 「豚肉200g」「卵2個」
  const glued = line.match(new RegExp(`^(.+?)(${QTY}.*)$`));
  if (glued && glued[1].trim().length > 0) {
    return { name: glued[1].trim(), amount: glued[2].trim() };
  }

  return { name: line, amount: "" };
}

function parseQuantity(raw: string): number | null {
  const map: Record<string, number> = {
    "½": 0.5,
    "⅓": 1 / 3,
    "⅔": 2 / 3,
    "¼": 0.25,
    "¾": 0.75,
  };
  if (raw in map) return map[raw];
  if (raw.includes("/")) {
    const [a, b] = raw.split("/").map(Number);
    if (!b) return null;
    return a / b;
  }
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function roundQuantity(n: number): number {
  const nearestQuarter = Math.round(n * 4) / 4;
  if (Math.abs(n - nearestQuarter) < 0.06) return nearestQuarter;
  return Math.round(n * 10) / 10;
}

function formatQuantity(n: number): string {
  if (Number.isInteger(n)) return String(n);
  const quarters: Record<string, string> = {
    "0.25": "1/4",
    "0.5": "1/2",
    "0.75": "3/4",
  };
  const key = String(n);
  if (key in quarters) return quarters[key];
  return String(n);
}
