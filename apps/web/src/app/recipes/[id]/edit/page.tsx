"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { api, ApiError, type Category, type Recipe } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { scaleIngredients } from "@pf08/shared";

export default function EditRecipePage() {
  return (
    <RequireAuth>
      <EditInner />
    </RequireAuth>
  );
}

function EditInner() {
  const params = useParams<{ id: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [name, setName] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [editServings, setEditServings] = useState(2);
  const [ingredientsText, setIngredientsText] = useState("");
  const [instructionsText, setInstructionsText] = useState("");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [clearImage, setClearImage] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      const { recipe } = await api.getRecipe(params.id);
      setRecipe(recipe);
      const servings = user?.householdSize ?? 2;
      setEditServings(servings);
      setName(recipe.name);
      setSourceUrl(recipe.sourceUrl ?? "");
      setIngredientsText(scaleIngredients(recipe.ingredients, servings).join("\n"));
      setInstructionsText(recipe.instructions.join("\n"));
      setNotes(recipe.notes ?? "");
      setCategoryIds(recipe.categories.map((c) => c.id));
    })();
  }, [params.id, user?.householdSize]);

  useEffect(() => {
    void api.listCategories().then(({ categories }) => setCategories(categories));
  }, []);

  function toggleCategory(id: string) {
    setCategoryIds((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id],
    );
  }

  async function onSave(e: FormEvent) {
    e.preventDefault();
    if (!recipe) return;
    setBusy(true);
    setError("");
    try {
      await api.updateRecipe(recipe.id, {
        name,
        sourceUrl: sourceUrl || null,
        sourceServings: editServings,
        ingredients: ingredientsText
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean),
        instructions: instructionsText
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean),
        notes: notes || null,
        clearImage: clearImage || undefined,
        categoryIds,
      });
      if (file) await api.uploadImage(recipe.id, file);
      router.replace(`/recipes/${recipe.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "保存に失敗しました");
    } finally {
      setBusy(false);
    }
  }

  if (!recipe) {
    return (
      <AppShell>
        <p className="muted loading-dot">読み込み中…</p>
      </AppShell>
    );
  }

  if (user?.role === "reviewer") {
    return (
      <AppShell title="レシピ編集">
        <h1 style={{ marginTop: 12 }}>編集</h1>
        <p className="hint">閲覧のみのアカウントではレシピを編集できません。</p>
        <Link href={`/recipes/${recipe.id}`} className="btn btn-secondary">
          レシピに戻る
        </Link>
      </AppShell>
    );
  }

  return (
    <AppShell title="レシピ編集">
      <h1 style={{ marginTop: 12 }}>編集（AIなし）</h1>
      <p className="hint">
        画面は {editServings} 人分の見た目で編集できます。保存時に再び1人前へ正規化します。
      </p>
      <form className="panel" style={{ marginTop: 16 }} onSubmit={onSave}>
        <div className="field">
          <label htmlFor="name">料理名</label>
          <input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="field">
          <label htmlFor="sourceUrl">出典URL</label>
          <input
            id="sourceUrl"
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="editServings">編集中の分量（何人分の見た目か）</label>
          <input
            id="editServings"
            type="number"
            min={1}
            value={editServings}
            onChange={(e) => setEditServings(Number(e.target.value) || 1)}
          />
        </div>
        <div className="field">
          <label htmlFor="ingredients">材料</label>
          <textarea
            id="ingredients"
            value={ingredientsText}
            onChange={(e) => setIngredientsText(e.target.value)}
            style={{ minHeight: 140 }}
          />
        </div>
        <div className="field">
          <label htmlFor="instructions">手順</label>
          <textarea
            id="instructions"
            value={instructionsText}
            onChange={(e) => setInstructionsText(e.target.value)}
            style={{ minHeight: 140 }}
          />
        </div>
        <div className="field">
          <label htmlFor="notes">定番メモ</label>
          <textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
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
          <label htmlFor="image">サムネ差し替え（任意）</label>
          <input
            id="image"
            type="file"
            accept="image/*"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </div>
        {recipe.imageUrl ? (
          <label className="row" style={{ marginBottom: 14 }}>
            <input
              type="checkbox"
              checked={clearImage}
              onChange={(e) => setClearImage(e.target.checked)}
            />
            <span className="hint">サムネを削除する</span>
          </label>
        ) : null}
        {error ? <p className="error">{error}</p> : null}
        <button className="btn btn-block" disabled={busy}>
          {busy ? "保存中…" : "保存"}
        </button>
      </form>
    </AppShell>
  );
}
