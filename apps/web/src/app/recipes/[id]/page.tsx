"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { scaleIngredientRows } from "@pf08/shared";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { api, ApiError, type Recipe } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import styles from "./recipe.module.css";

export default function RecipeDetailPage() {
  return (
    <RequireAuth>
      <DetailInner />
    </RequireAuth>
  );
}

function DetailInner() {
  const params = useParams<{ id: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [displayServings, setDisplayServings] = useState(2);
  const [error, setError] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        const { recipe } = await api.getRecipe(params.id);
        setRecipe(recipe);
        setDisplayServings(user?.householdSize ?? 2);
      } catch (e) {
        setError(e instanceof ApiError ? e.message : "読み込みに失敗しました");
      }
    })();
  }, [params.id, user?.householdSize]);

  const ingredientRows = useMemo(() => {
    if (!recipe) return [];
    const n = Math.max(1, Math.floor(displayServings) || 1);
    return scaleIngredientRows(recipe.ingredients, n);
  }, [recipe, displayServings]);

  async function onDelete() {
    if (!recipe) return;
    if (!confirm("このレシピを削除（またはアーカイブ）しますか？")) return;
    await api.deleteRecipe(recipe.id);
    router.replace("/recipes");
  }

  if (error) {
    return (
      <AppShell>
        <p className="error">{error}</p>
      </AppShell>
    );
  }
  if (!recipe) {
    return (
      <AppShell>
        <p className="muted loading-dot">読み込み中…</p>
      </AppShell>
    );
  }

  const img = api.imageSrc(recipe.imageUrl);

  return (
    <AppShell>
      {img ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={img}
          alt=""
          style={{
            width: "100%",
            maxHeight: 240,
            objectFit: "cover",
            borderRadius: 16,
            marginTop: 8,
            marginBottom: 16,
          }}
        />
      ) : null}

      <h1 style={{ marginTop: 8 }}>{recipe.name}</h1>
      {recipe.sourceUrl ? (
        <p>
          <a href={recipe.sourceUrl} target="_blank" rel="noreferrer" className="muted">
            出典を開く ↗
          </a>
        </p>
      ) : null}

      <div className="row" style={{ margin: "16px 0" }}>
        <Link href={`/recipes/${recipe.id}/edit`} className="btn btn-secondary">
          編集
        </Link>
        <Link href={`/cook/new?recipeId=${recipe.id}`} className="btn">
          作った
        </Link>
        <button type="button" className="btn btn-secondary" onClick={onDelete}>
          削除
        </button>
      </div>

      <section className="panel" style={{ marginBottom: 14 }}>
        <div className="row" style={{ marginBottom: 12 }}>
          <label htmlFor="servings" className="muted">
            分量表示
          </label>
          <input
            id="servings"
            type="number"
            min={1}
            value={displayServings}
            onChange={(e) => setDisplayServings(Number(e.target.value))}
            style={{
              width: 72,
              border: "1px solid var(--line)",
              borderRadius: 10,
              padding: "8px 10px",
            }}
          />
          <span>人前</span>
        </div>
        <h2>材料</h2>
        {ingredientRows.length === 0 ? (
          <p className="hint">材料がありません</p>
        ) : (
          <table className={styles.ingredientTable}>
            <thead>
              <tr>
                <th scope="col">材料</th>
                <th scope="col">使用量</th>
              </tr>
            </thead>
            <tbody>
              {ingredientRows.map((row, i) =>
                row.kind === "section" ? (
                  <tr key={`s-${i}-${row.name}`} className={styles.sectionRow}>
                    <td colSpan={2}>{row.name}</td>
                  </tr>
                ) : (
                  <tr key={`i-${i}-${row.name}-${row.amount}`}>
                    <td>{row.name || "—"}</td>
                    <td className={styles.amount}>{row.amount || "—"}</td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        )}
        <p className="hint">DBは1人前。表示だけ × 人前で換算しています。</p>
      </section>

      <section className="panel" style={{ marginBottom: 14 }}>
        <h2>手順</h2>
        <ol>
          {recipe.instructions.map((line, i) => (
            <li key={`${i}-${line}`}>{line}</li>
          ))}
        </ol>
      </section>

      {recipe.notes ? (
        <section className="panel">
          <h2>定番メモ</h2>
          <p style={{ whiteSpace: "pre-wrap" }}>{recipe.notes}</p>
        </section>
      ) : null}
    </AppShell>
  );
}
