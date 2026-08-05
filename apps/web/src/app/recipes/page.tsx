"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { api, ApiError, type Category, type Recipe } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export default function RecipesPage() {
  return (
    <RequireAuth>
      <RecipesInner />
    </RequireAuth>
  );
}

function RecipesInner() {
  const { user } = useAuth();
  const isReviewer = user?.role === "reviewer";
  const [q, setQ] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [busy, setBusy] = useState(true);
  const [requestingId, setRequestingId] = useState<string | null>(null);
  const [requestedIds, setRequestedIds] = useState<Set<string>>(new Set());
  const [requestError, setRequestError] = useState("");

  async function load(search?: string, cat?: string) {
    setBusy(true);
    try {
      const { recipes } = await api.listRecipes(search, cat || undefined);
      setRecipes(recipes);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void load();
    void api.listCategories().then(({ categories }) => setCategories(categories));
  }, []);

  function onSearch(e: FormEvent) {
    e.preventDefault();
    void load(q.trim() || undefined, categoryId || undefined);
  }

  function onCategoryChange(next: string) {
    setCategoryId(next);
    void load(q.trim() || undefined, next || undefined);
  }

  async function onRequestToday(recipeId: string) {
    setRequestingId(recipeId);
    setRequestError("");
    try {
      await api.requestMealProposalCandidate(recipeId);
      setRequestedIds((prev) => new Set(prev).add(recipeId));
    } catch (err) {
      setRequestError(err instanceof ApiError ? err.message : "リクエストに失敗しました");
    } finally {
      setRequestingId(null);
    }
  }

  return (
    <AppShell title="レシピ一覧">
      <div className="row" style={{ margin: "12px 0 16px", justifyContent: "space-between" }}>
        <h1>レシピ</h1>
        {user?.role !== "reviewer" ? (
          <Link href="/recipes/new" className="btn">
            新規
          </Link>
        ) : null}
      </div>

      <form className="row" onSubmit={onSearch} style={{ marginBottom: 12 }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="料理名・材料・メモ・タグで検索"
          style={{
            flex: 1,
            minWidth: 160,
            border: "1px solid var(--line)",
            borderRadius: 12,
            padding: "12px 14px",
            background: "rgba(255,255,255,0.85)",
          }}
        />
        <button className="btn btn-secondary" type="submit">
          検索
        </button>
      </form>

      {categories.length > 0 ? (
        <div className="field" style={{ marginBottom: 16 }}>
          <label htmlFor="categoryFilter">カテゴリで絞り込み</label>
          <select
            id="categoryFilter"
            value={categoryId}
            onChange={(e) => onCategoryChange(e.target.value)}
          >
            <option value="">すべて</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {requestError ? <p className="error">{requestError}</p> : null}

      {busy ? (
        <p className="muted loading-dot">読み込み中…</p>
      ) : recipes.length === 0 ? (
        <p className="hint">レシピがありません</p>
      ) : isReviewer ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
            gap: 14,
          }}
        >
          {recipes.map((r) => {
            const requested = requestedIds.has(r.id);
            return (
              <div key={r.id} className="panel" style={{ padding: 10 }}>
                {r.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={api.imageSrc(r.imageUrl) ?? undefined}
                    alt=""
                    style={{
                      width: "100%",
                      aspectRatio: "1 / 1",
                      objectFit: "cover",
                      borderRadius: 12,
                      display: "block",
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: "100%",
                      aspectRatio: "1 / 1",
                      borderRadius: 12,
                      background: "rgba(31,107,92,0.12)",
                    }}
                  />
                )}
                <strong
                  style={{
                    display: "block",
                    marginTop: 8,
                    fontFamily: "var(--font-display)",
                    fontSize: "1rem",
                  }}
                >
                  {r.name}
                </strong>
                <button
                  type="button"
                  className={requested ? "btn btn-secondary btn-block" : "btn btn-block"}
                  style={{ marginTop: 8 }}
                  disabled={requestingId === r.id}
                  onClick={() => void onRequestToday(r.id)}
                >
                  {requested
                    ? "リクエスト済み"
                    : requestingId === r.id
                      ? "送信中…"
                      : "今日のリクエスト"}
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <ul className="clean stack">
          {recipes.map((r) => (
            <li key={r.id} className="panel">
              <Link href={`/recipes/${r.id}`} className="row" style={{ gap: 14 }}>
                {r.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={api.imageSrc(r.imageUrl) ?? undefined}
                    alt=""
                    width={64}
                    height={64}
                    style={{
                      width: 64,
                      height: 64,
                      objectFit: "cover",
                      borderRadius: 12,
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: 64,
                      height: 64,
                      borderRadius: 12,
                      background: "rgba(31,107,92,0.12)",
                    }}
                  />
                )}
                <div>
                  <strong style={{ fontFamily: "var(--font-display)", fontSize: "1.1rem" }}>
                    {r.name}
                  </strong>
                  {r.isHallOfFame ? (
                    <span className="chip" style={{ marginLeft: 8 }}>
                      殿堂
                    </span>
                  ) : null}
                  {r.categories.length > 0 ? (
                    <div className="chip-row" style={{ marginTop: 6 }}>
                      {r.categories.map((c) => (
                        <span key={c.id} className="chip">
                          {c.name}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  {r.notes ? <div className="hint" style={{ marginTop: 4 }}>{r.notes}</div> : null}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}
