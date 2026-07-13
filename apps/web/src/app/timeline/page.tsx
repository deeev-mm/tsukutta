"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { api, type CookLog } from "@/lib/api";

export default function TimelinePage() {
  return (
    <RequireAuth>
      <TimelineInner />
    </RequireAuth>
  );
}

function TimelineInner() {
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
        <Link href="/cook/new" className="btn">
          追加
        </Link>
      </div>
      {busy ? (
        <p className="muted loading-dot">読み込み中…</p>
      ) : logs.length === 0 ? (
        <p className="hint">まだ記録がありません</p>
      ) : (
        <ul className="clean stack">
          {logs.map((l) => (
            <li key={l.id} className="panel">
              <div className="muted" style={{ fontSize: "0.85rem" }}>
                {l.cookedAt}
              </div>
              <Link href={`/recipes/${l.recipeId}`}>
                <strong style={{ fontFamily: "var(--font-display)", fontSize: "1.15rem" }}>
                  {l.recipeName}
                </strong>
              </Link>
              {l.cookNote ? (
                <p style={{ margin: "8px 0 0", whiteSpace: "pre-wrap" }}>{l.cookNote}</p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}
