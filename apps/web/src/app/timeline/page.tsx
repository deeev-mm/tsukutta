"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { api, ApiError, type CookLog, type CookLogRating } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { StarRating } from "@/components/StarRating";
import { IconStar } from "@/components/icons";

export default function TimelinePage() {
  return (
    <RequireAuth>
      <TimelineInner />
    </RequireAuth>
  );
}

function TimelineInner() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<CookLog[]>([]);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const { cookLogs } = await api.listCookLogs();
        setLogs(cookLogs);
      } finally {
        setBusy(false);
      }
    })();
  }, []);

  return (
    <AppShell title="タイムライン">
      <div className="row" style={{ margin: "12px 0 16px", justifyContent: "space-between" }}>
        <h1>記録</h1>
        {user?.role !== "reviewer" ? (
          <Link href="/cook/new" className="btn">
            追加
          </Link>
        ) : null}
      </div>
      {busy ? (
        <p className="muted loading-dot">読み込み中…</p>
      ) : logs.length === 0 ? (
        <p className="hint">まだ記録がありません</p>
      ) : (
        <ul className="clean stack">
          {logs.map((l) => (
            <CookLogItem key={l.id} log={l} />
          ))}
        </ul>
      )}
    </AppShell>
  );
}

function CookLogItem({ log }: { log: CookLog }) {
  const { user } = useAuth();
  const [expanded, setExpanded] = useState(false);
  const [loadingRatings, setLoadingRatings] = useState(false);
  const [ratings, setRatings] = useState<CookLogRating[]>([]);
  const [rating, setRating] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [ratingsReady, setRatingsReady] = useState(false);

  const myRating = ratings.find((r) => r.userId === user?.id);
  const rated = ratings.filter((r) => r.rating != null);
  const avg =
    rated.length > 0
      ? rated.reduce((sum, r) => sum + (r.rating ?? 0), 0) / rated.length
      : null;

  async function loadRatings() {
    setLoadingRatings(true);
    try {
      const { ratings } = await api.listCookLogRatings(log.id);
      setRatings(ratings);
      const mine = ratings.find((r) => r.userId === user?.id);
      setRating(mine?.rating ?? null);
      setComment(mine?.comment ?? "");
    } finally {
      setLoadingRatings(false);
      setRatingsReady(true);
    }
  }

  useEffect(() => {
    void loadRatings();
    // 一覧表示時に平均★を出すため、展開前に取得する
    // eslint-disable-next-line react-hooks/exhaustive-deps -- log.id 変更時のみ再取得
  }, [log.id]);

  function onExpand() {
    setExpanded((prev) => !prev);
  }

  async function onSubmitRating(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api.upsertCookLogRating(log.id, {
        rating: rating ?? undefined,
        comment: comment || undefined,
      });
      await loadRatings();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "評価の保存に失敗しました");
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="panel">
      <div className="muted" style={{ fontSize: "0.85rem" }}>
        {log.cookedAt}
      </div>
      <Link href={`/recipes/${log.recipeId}`}>
        <strong style={{ fontFamily: "var(--font-display)", fontSize: "1.15rem" }}>
          {log.recipeName}
        </strong>
      </Link>
      {log.cookNote ? (
        <p style={{ margin: "8px 0 0", whiteSpace: "pre-wrap" }}>{log.cookNote}</p>
      ) : null}

      <div className="row" style={{ marginTop: 10, justifyContent: "space-between" }}>
        <div className="row" style={{ gap: 6 }}>
          {!ratingsReady ? (
            <span className="hint loading-dot">評価を確認中…</span>
          ) : avg != null ? (
            <StarRating value={avg} />
          ) : (
            <span className="hint">まだ評価がありません</span>
          )}
          {ratingsReady && rated.length > 0 ? (
            <span className="hint">
              （{avg?.toFixed(1)} ・ {rated.length}件）
            </span>
          ) : null}
        </div>
        <button type="button" className="btn btn-secondary" onClick={onExpand}>
          {expanded ? "閉じる" : myRating ? "評価を編集" : "評価する"}
        </button>
      </div>

      {expanded ? (
        <div style={{ marginTop: 12, borderTop: "1px solid var(--line)", paddingTop: 12 }}>
          {loadingRatings ? (
            <p className="muted loading-dot">読み込み中…</p>
          ) : (
            <>
              {ratings.length > 0 ? (
                <ul className="clean stack" style={{ marginBottom: 12 }}>
                  {ratings.map((r) => (
                    <li key={r.id}>
                      <div className="row" style={{ gap: 8 }}>
                        <strong style={{ fontSize: "0.85rem" }}>{r.displayName}</strong>
                        {r.rating != null ? <StarRating value={r.rating} /> : null}
                      </div>
                      {r.comment ? (
                        <p className="hint" style={{ margin: "2px 0 0" }}>
                          {r.comment}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : null}

              <form onSubmit={onSubmitRating}>
                <div className="field">
                  <label>あなたの評価</label>
                  <div className="row" style={{ gap: 2 }}>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        type="button"
                        className={`star-btn ${rating != null && n <= rating ? "on" : ""}`}
                        onClick={() => setRating(n === rating ? null : n)}
                        aria-label={`${n}つ星`}
                      >
                        <IconStar filled={rating != null && n <= rating} size={22} />
                      </button>
                    ))}
                  </div>
                </div>
                <div className="field">
                  <label htmlFor={`comment-${log.id}`}>コメント（任意）</label>
                  <textarea
                    id={`comment-${log.id}`}
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="感想を一言"
                  />
                </div>
                {error ? <p className="error">{error}</p> : null}
                <button className="btn" disabled={busy}>
                  {busy ? "保存中…" : "保存する"}
                </button>
              </form>
            </>
          )}
        </div>
      ) : null}
    </li>
  );
}
