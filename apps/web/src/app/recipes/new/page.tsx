"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { GROQ_API_KEY_URL, type IngredientLine } from "@tsukutta/shared";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { IngredientListEditor } from "@/components/IngredientListEditor";
import { StepListEditor } from "@/components/StepListEditor";
import { api, ApiError, type Category } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useGroqKey } from "@/lib/groq-key";

type Draft = {
  name: string;
  sourceUrl: string;
  sourceServings: number;
  ingredients: IngredientLine[];
  instructions: string[];
  notes: string;
};

const emptyDraft: Draft = {
  name: "",
  sourceUrl: "",
  sourceServings: 2,
  ingredients: [],
  instructions: [],
  notes: "",
};

export default function NewRecipePage() {
  return (
    <RequireAuth>
      <NewRecipeInner />
    </RequireAuth>
  );
}

function NewRecipeInner() {
  const { hasKey } = useGroqKey();
  const { user } = useAuth();
  const router = useRouter();

  const [step, setStep] = useState<"paste" | "preview">("paste");
  const [rawText, setRawText] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [file, setFile] = useState<File | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void api.listCategories().then(({ categories }) => setCategories(categories));
  }, []);

  function toggleCategory(id: string) {
    setCategoryIds((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id],
    );
  }

  const canFormat = useMemo(() => {
    if (!rawText.trim() || !agreed || !hasKey) return false;
    return true;
  }, [rawText, agreed, hasKey]);

  async function onFormat(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { result } = await api.formatAi(rawText, sourceUrl || undefined);
      setDraft({
        name: result.name,
        sourceUrl,
        sourceServings: result.sourceServings ?? 2,
        ingredients: result.ingredients,
        instructions: result.instructions,
        notes: result.notes,
      });
      setStep("preview");
    } catch (err) {
      if (err instanceof ApiError && err.code === "GROQ_KEY_MISSING") {
        setError("Groq APIキーが未設定です。設定画面で登録してください。");
      } else {
        setError(err instanceof ApiError ? err.message : "AI整形に失敗しました");
      }
    } finally {
      setBusy(false);
    }
  }

  async function onSave(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { recipe } = await api.createRecipe({
        name: draft.name,
        sourceUrl: draft.sourceUrl || null,
        sourceServings: draft.sourceServings,
        ingredients: draft.ingredients
          .map((row) => ({
            name: row.name.trim(),
            amount: row.amount.trim(),
            isSection: row.isSection,
          }))
          .filter((row) => (row.isSection ? row.name : row.name || row.amount)),
        instructions: draft.instructions.map((s) => s.trim()).filter(Boolean),
        notes: draft.notes || null,
        categoryIds,
      });
      if (file) {
        await api.uploadImage(recipe.id, file);
      }
      router.replace(`/recipes/${recipe.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "保存に失敗しました");
    } finally {
      setBusy(false);
    }
  }

  if (user?.role === "reviewer") {
    return (
      <AppShell title="レシピ作成">
        <h1 style={{ marginTop: 12 }}>レシピを残す</h1>
        <p className="hint">閲覧のみのアカウントではレシピを作成できません。</p>
        <Link href="/recipes" className="btn btn-secondary">
          レシピ一覧へ
        </Link>
      </AppShell>
    );
  }

  return (
    <AppShell title="レシピ作成">
      <h1 style={{ marginTop: 12 }}>レシピを残す</h1>
      <p className="hint">
        コピペ → AI整形 → 微修正 → 保存（手入力だけで新規保存する導線はありません）
      </p>
      <p className="hint">
        貼るのは「料理名・材料・手順」だけで十分です。レビューやフッターまで全部貼ると文字数が増え、無料枠を消費しやすいです。
      </p>

      {step === "paste" ? (
        <form className="panel" style={{ marginTop: 16 }} onSubmit={onFormat}>
          <div className="field">
            <label htmlFor="sourceUrl">出典URL（任意）</label>
            <input
              id="sourceUrl"
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              placeholder="https://"
            />
          </div>
          <div className="field">
            <label htmlFor="rawText">レシピ本文（コピペ）</label>
            <textarea
              id="rawText"
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              required
              placeholder={"例:\nのせるだけ簡単！ふわとろオムライス\n材料【1人分】\nごはん どんぶり1杯(200g)\n卵 2個\n...\n手順\n1. 玉ねぎはみじん切りにする。\n2. ..."}
              style={{ minHeight: 200 }}
            />
            {rawText.length > 6000 ? (
              <p className="hint" style={{ color: "var(--amber)" }}>
                文字数が多めです（{rawText.length.toLocaleString()}字）。材料・手順だけに絞るとクォータ消費を抑えられます。
              </p>
            ) : null}
          </div>

          <div className="notice">
            AI整形では入力したテキストを Groq API に送信します。
            提供元側で処理・学習等に利用される可能性があります。
            <strong>
              個人情報・秘密にしたい内容・学習されて困る文章は入力しないでください。
            </strong>
            <br />
            APIキーはこの端末のブラウザ（localStorage）にだけ保存され、当サービスのサーバーには保存しません。
          </div>

          {!hasKey ? (
            <p className="error">
              Groq APIキーが未設定です。
              <Link href="/settings">設定</Link>
              でキーを localStorage に保存してください。発行は{" "}
              <a href={GROQ_API_KEY_URL} target="_blank" rel="noreferrer">
                Groq Console
              </a>
              。
            </p>
          ) : null}

          <label className="row" style={{ marginBottom: 14, alignItems: "flex-start" }}>
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              style={{ marginTop: 4 }}
            />
            <span className="hint">上記を理解して整形する</span>
          </label>

          {error ? <p className="error">{error}</p> : null}
          <button className="btn btn-block" disabled={!canFormat || busy}>
            {busy ? "整形中…" : "AIで整形する"}
          </button>
        </form>
      ) : (
        <form className="panel" style={{ marginTop: 16 }} onSubmit={onSave}>
          <p className="hint">内容を確認・微修正してから保存してください。材料は保存時に1人前へ正規化されます。</p>
          <div className="field">
            <label htmlFor="name">料理名</label>
            <input
              id="name"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="sourceUrl2">出典URL</label>
            <input
              id="sourceUrl2"
              value={draft.sourceUrl}
              onChange={(e) => setDraft({ ...draft, sourceUrl: e.target.value })}
            />
          </div>
          <div className="field">
            <label htmlFor="sourceServings">いまの分量は何人分？</label>
            <input
              id="sourceServings"
              type="number"
              min={1}
              value={draft.sourceServings}
              onChange={(e) =>
                setDraft({ ...draft, sourceServings: Number(e.target.value) || 1 })
              }
              required
            />
          </div>
          <div className="field">
            <label>材料</label>
            <IngredientListEditor
              value={draft.ingredients}
              onChange={(ingredients) => setDraft({ ...draft, ingredients })}
            />
          </div>
          <div className="field">
            <label>手順</label>
            <StepListEditor
              value={draft.instructions}
              onChange={(instructions) => setDraft({ ...draft, instructions })}
            />
          </div>
          <div className="field">
            <label htmlFor="notes">定番メモ（任意）</label>
            <textarea
              id="notes"
              value={draft.notes}
              onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
            />
          </div>
          {categories.length > 0 ? (
            <div className="field">
              <label>カテゴリ（任意・複数選択可）</label>
              <div className="chip-row">
                {categories.map((c) => (
                  <label
                    key={c.id}
                    className="chip-checkbox"
                    style={
                      categoryIds.includes(c.id)
                        ? { background: "rgba(31,107,92,0.14)", borderColor: "var(--teal)" }
                        : undefined
                    }
                  >
                    <input
                      type="checkbox"
                      checked={categoryIds.includes(c.id)}
                      onChange={() => toggleCategory(c.id)}
                      style={{ margin: 0 }}
                    />
                    {c.name}
                  </label>
                ))}
              </div>
            </div>
          ) : null}
          <div className="field">
            <label htmlFor="image">サムネイル（任意・1枚）</label>
            <input
              id="image"
              type="file"
              accept="image/*"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>
          {error ? <p className="error">{error}</p> : null}
          <div className="row">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setStep("paste")}
              disabled={busy}
            >
              戻る
            </button>
            <button className="btn" disabled={busy}>
              {busy ? "保存中…" : "保存する"}
            </button>
          </div>
        </form>
      )}
    </AppShell>
  );
}
