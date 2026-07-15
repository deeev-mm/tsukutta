"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { TodayMealSection } from "@/components/TodayMealSection";
import { api, ApiError, type CookLog, type Recipe, type RankingEntry } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useGroqKey } from "@/lib/groq-key";

export default function HomePage() {
  return (
    <RequireAuth>
      <HomeInner />
    </RequireAuth>
  );
}

function HomeInner() {
  const { user } = useAuth();
  const { hasKey } = useGroqKey();
  const [recentLogs, setRecentLogs] = useState<CookLog[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [recs, setRecs] = useState<
    Awaited<ReturnType<typeof api.listRecommendations>>["recommendations"]
  >([]);
  const [aiPick, setAiPick] = useState<(RankingEntry & { comment: string }) | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState("");
  const [cookedRecipeCount, setCookedRecipeCount] = useState(0);
  const [cookLogCount, setCookLogCount] = useState(0);

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
      setCookLogCount(logs.cookLogs.length);
      setCookedRecipeCount(new Set(logs.cookLogs.map((l) => l.recipeId)).size);
    })();
  }, []);

  // AIおすすめは「作った記録があるレシピ」を候補にするため、種類・件数が少ないと
  // 選択肢がなく精度が落ちる。目安として下回っている間だけ注意書きを出す。
  const AI_MIN_RECIPES = 5;
  const AI_MIN_LOGS = 10;
  const aiDataThin = cookedRecipeCount < AI_MIN_RECIPES || cookLogCount < AI_MIN_LOGS;

  async function onAskAi() {
    setAiBusy(true);
    setAiError("");
    try {
      const { recommendation } = await api.recommendWithAi();
      setAiPick(recommendation);
    } catch (e) {
      setAiError(e instanceof ApiError ? e.message : "AIおすすめの取得に失敗しました");
    } finally {
      setAiBusy(false);
    }
  }

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

      <TodayMealSection />

      {user?.role !== "reviewer" ? (
      <section className="panel" style={{ marginBottom: 16 }}>
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h2 style={{ margin: 0 }}>今日のおすすめをAIに聞く</h2>
        </div>
        <p className="hint" style={{ marginTop: 8, marginBottom: 12 }}>
          直近の調理記録を踏まえて、Groqが1品だけ提案します。押したときだけ呼び出すので、開くたびには消費しません。
        </p>
        {!hasKey ? (
          <p className="hint">
            <Link href="/settings">設定画面</Link>でGroq APIキーを登録すると使えます
          </p>
        ) : aiDataThin ? (
          <p className="hint">
            「作った」記録がもう少し増えると使えます（目安: 作ったレシピ{AI_MIN_RECIPES}品以上・記録{AI_MIN_LOGS}件以上／現在
            {cookedRecipeCount}品・{cookLogCount}件）。それまでは候補が少なく精度が出ないため非表示にしています。
          </p>
        ) : (
          <>
            <button type="button" className="btn" onClick={() => void onAskAi()} disabled={aiBusy}>
              {aiBusy ? "考え中…" : "AIにおすすめを聞く"}
            </button>
            {aiError ? <p className="error">{aiError}</p> : null}
            {aiPick ? (
              <div style={{ marginTop: 12 }}>
                <Link href={`/recipes/${aiPick.recipeId}`}>
                  <strong>{aiPick.name}</strong>
                </Link>
                <p className="hint" style={{ marginTop: 4 }}>{aiPick.comment}</p>
              </div>
            ) : null}
          </>
        )}
      </section>
      ) : null}

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
