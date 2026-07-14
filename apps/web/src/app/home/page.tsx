"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { api, type CookLog, type Recipe } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export default function HomePage() {
  return (
    <RequireAuth>
      <HomeInner />
    </RequireAuth>
  );
}

function HomeInner() {
  const { user } = useAuth();
  const [recentLogs, setRecentLogs] = useState<CookLog[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [recs, setRecs] = useState<
    Awaited<ReturnType<typeof api.listRecommendations>>["recommendations"]
  >([]);

  useEffect(() => {
    void (async () => {
      const [logs, rec, recommendations] = await Promise.all([
        api.listCookLogs(),
        api.listRecipes(),
        api.listRecommendations(3),
      ]);
      setRecentLogs(logs.cookLogs.slice(0, 5));
      setRecipes(rec.recipes.slice(0, 5));
      setRecs(recommendations.recommendations);
    })();
  }, []);

  return (
    <AppShell>
      <section style={{ marginTop: 12, marginBottom: 28 }}>
        <h1>こんにちは、{user?.displayName}</h1>
        <p className="muted">
          {user?.familyName || "うちのキッチン"} ・ {user?.householdSize}人前が標準
        </p>
      </section>

      <div className="stack" style={{ marginBottom: 28 }}>
        {user?.role === "reviewer" ? (
          <>
            <Link href="/timeline" className="btn btn-block">
              記録を見て評価する
            </Link>
            <Link href="/rankings" className="btn btn-secondary btn-block">
              見返しを見る
            </Link>
          </>
        ) : (
          <>
            <Link href="/recipes/new" className="btn btn-block">
              レシピを残す
            </Link>
            <Link href="/cook/new" className="btn btn-secondary btn-block">
              今日作った
            </Link>
          </>
        )}
      </div>

      {recs.length > 0 ? (
        <section className="panel" style={{ marginBottom: 16 }}>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <h2 style={{ margin: 0 }}>また作るなら</h2>
            <Link href="/rankings" className="hint">
              もっと見る
            </Link>
          </div>
          <ul className="clean stack" style={{ marginTop: 12 }}>
            {recs.map((r) => (
              <li key={r.recipeId}>
                <Link href={`/recipes/${r.recipeId}`}>
                  <strong>{r.name}</strong>
                  <span className="muted"> · {r.reason}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="panel" style={{ marginBottom: 16 }}>
        <h2>最近の記録</h2>
        {recentLogs.length === 0 ? (
          <p className="hint">まだ記録がありません</p>
        ) : (
          <ul className="clean stack">
            {recentLogs.map((l) => (
              <li key={l.id}>
                <Link href={`/timeline`}>
                  <strong>{l.recipeName}</strong>
                  <span className="muted"> · {l.cookedAt}</span>
                  {l.cookNote ? (
                    <div className="hint">{l.cookNote}</div>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel">
        <h2>レシピ</h2>
        {recipes.length === 0 ? (
          <p className="hint">最初のレシピを残してみましょう</p>
        ) : (
          <ul className="clean stack">
            {recipes.map((r) => (
              <li key={r.id}>
                <Link href={`/recipes/${r.id}`}>
                  <strong>{r.name}</strong>
                  {r.isHallOfFame ? (
                    <span className="chip" style={{ marginLeft: 8 }}>
                      殿堂
                    </span>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </AppShell>
  );
}
