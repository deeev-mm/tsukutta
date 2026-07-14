"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import {
  api,
  type Category,
  type RankingEntry,
  type Recipe,
  type RecommendationEntry,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";

type Tab = "ranking" | "hall" | "recommend";

export default function RankingsPage() {
  return (
    <RequireAuth>
      <RankingsInner />
    </RequireAuth>
  );
}

function RankingsInner() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("ranking");
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [rankings, setRankings] = useState<RankingEntry[]>([]);
  const [hall, setHall] = useState<Recipe[]>([]);
  const [recs, setRecs] = useState<RecommendationEntry[]>([]);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    void api.listCategories().then((r) => setCategories(r.categories));
  }, []);

  useEffect(() => {
    void (async () => {
      setBusy(true);
      try {
        if (tab === "ranking") {
          const { rankings } = await api.listRankings(categoryId || undefined);
          setRankings(rankings);
        } else if (tab === "hall") {
          const { recipes } = await api.listRecipes(undefined, undefined, true);
          setHall(recipes);
        } else {
          const { recommendations } = await api.listRecommendations(8);
          setRecs(recommendations);
        }
      } finally {
        setBusy(false);
      }
    })();
  }, [tab, categoryId]);

  return (
    <AppShell title="見返し">
      <h1 style={{ marginTop: 12 }}>見返し</h1>
      <p className="hint" style={{ marginBottom: 16 }}>
        よく作ったもの・殿堂・また作りたい候補を家族スコープで見ます。
      </p>

      <div className="row" style={{ gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {(
          [
            ["ranking", "ランキング"],
            ["hall", "殿堂入り"],
            ["recommend", "また作る"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`btn ${tab === id ? "" : "btn-secondary"}`}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "ranking" ? (
        <div className="field" style={{ marginBottom: 12 }}>
          <label htmlFor="rankCat">カテゴリで絞り込み</label>
          <select
            id="rankCat"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
          >
            <option value="">全体</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {busy ? (
        <p className="muted loading-dot">読み込み中…</p>
      ) : tab === "ranking" ? (
        rankings.length === 0 ? (
          <p className="hint">まだ「作った」記録がありません</p>
        ) : (
          <ol className="clean stack">
            {rankings.map((r) => (
              <li key={r.recipeId} className="panel">
                <Link href={`/recipes/${r.recipeId}`}>
                  <div className="row" style={{ justifyContent: "space-between" }}>
                    <div>
                      <span className="muted" style={{ marginRight: 8 }}>
                        #{r.rank}
                      </span>
                      <strong
                        style={{
                          fontFamily: "var(--font-display)",
                          fontSize: "1.1rem",
                        }}
                      >
                        {r.name}
                      </strong>
                      {r.isHallOfFame ? (
                        <span className="chip" style={{ marginLeft: 8 }}>
                          殿堂
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <p className="hint" style={{ margin: "6px 0 0" }}>
                    {r.cookCount}回作った
                    {r.avgRating != null
                      ? ` ・ 平均★${r.avgRating}（${r.ratingCount}件）`
                      : " ・ まだ評価なし"}
                    {r.lastCookedAt ? ` ・ 最近 ${r.lastCookedAt}` : ""}
                  </p>
                </Link>
              </li>
            ))}
          </ol>
        )
      ) : tab === "hall" ? (
        hall.length === 0 ? (
          <p className="hint">
            殿堂入りはまだありません。レシピ詳細から認定できます。
          </p>
        ) : (
          <ul className="clean stack">
            {hall.map((r) => (
              <li key={r.id} className="panel">
                <Link href={`/recipes/${r.id}`}>
                  <strong
                    style={{
                      fontFamily: "var(--font-display)",
                      fontSize: "1.1rem",
                    }}
                  >
                    {r.name}
                  </strong>
                  <span className="chip" style={{ marginLeft: 8 }}>
                    殿堂
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )
      ) : recs.length === 0 ? (
        <p className="hint">おすすめを出すには、作った記録が必要です</p>
      ) : (
        <ul className="clean stack">
          {recs.map((r) => (
            <li key={r.recipeId} className="panel">
              <Link href={`/recipes/${r.recipeId}`}>
                <strong
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: "1.1rem",
                  }}
                >
                  {r.name}
                </strong>
                {r.isHallOfFame ? (
                  <span className="chip" style={{ marginLeft: 8 }}>
                    殿堂
                  </span>
                ) : null}
                <p className="hint" style={{ margin: "6px 0 0" }}>
                  {r.reason}
                  {r.avgRating != null ? ` ・ ★${r.avgRating}` : ""}
                  {` ・ ${r.cookCount}回`}
                  {r.daysSinceLastCooked > 0
                    ? ` ・ ${r.daysSinceLastCooked}日前`
                    : " ・ 今日作った"}
                </p>
              </Link>
              {user?.role !== "reviewer" ? (
                <div className="row" style={{ marginTop: 10 }}>
                  <Link
                    href={`/cook/new?recipeId=${r.recipeId}`}
                    className="btn"
                  >
                    今日作る
                  </Link>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}
