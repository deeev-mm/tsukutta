"use client";

import { Suspense } from "react";
import { FormEvent, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { api, ApiError, type Recipe } from "@/lib/api";

export default function NewCookLogPage() {
  return (
    <RequireAuth>
      <Suspense fallback={<div className="container"><p className="muted loading-dot">読み込み中…</p></div>}>
        <NewCookInner />
      </Suspense>
    </RequireAuth>
  );
}

function NewCookInner() {
  const search = useSearchParams();
  const router = useRouter();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [recipeId, setRecipeId] = useState(search.get("recipeId") ?? "");
  const [cookedAt, setCookedAt] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [cookNote, setCookNote] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      const { recipes } = await api.listRecipes();
      setRecipes(recipes);
      setRecipeId((current) => current || recipes[0]?.id || "");
    })();
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api.createCookLog({
        recipeId,
        cookedAt,
        cookNote: cookNote || undefined,
      });
      router.replace("/timeline");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "記録に失敗しました");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell title="作った記録">
      <h1 style={{ marginTop: 12 }}>今日作った</h1>
      <form className="panel" style={{ marginTop: 16 }} onSubmit={onSubmit}>
        <div className="field">
          <label htmlFor="recipeId">レシピ</label>
          <select
            id="recipeId"
            value={recipeId}
            onChange={(e) => setRecipeId(e.target.value)}
            required
          >
            <option value="" disabled>
              選択してください
            </option>
            {recipes.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="cookedAt">作った日</label>
          <input
            id="cookedAt"
            type="date"
            value={cookedAt}
            onChange={(e) => setCookedAt(e.target.value)}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="cookNote">その回の一言（任意）</label>
          <textarea
            id="cookNote"
            value={cookNote}
            onChange={(e) => setCookNote(e.target.value)}
            placeholder="例: 今日は玉ねぎ多め"
          />
        </div>
        {error ? <p className="error">{error}</p> : null}
        <button className="btn btn-block" disabled={busy || !recipeId}>
          {busy ? "保存中…" : "記録する"}
        </button>
      </form>
    </AppShell>
  );
}
