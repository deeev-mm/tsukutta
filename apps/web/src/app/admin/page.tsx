"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import { RequireAdmin } from "@/components/RequireAdmin";
import { api, type AdminFamily } from "@/lib/api";

type Counts = {
  families: number;
  users: number;
  recipes: number;
  cookLogs: number;
  ratings: number;
};

const kpiLabel: Record<keyof Counts, string> = {
  families: "Family数",
  users: "ユーザー数",
  recipes: "レシピ数",
  cookLogs: "記録数",
  ratings: "評価数",
};

export default function AdminDashboardPage() {
  return (
    <RequireAdmin>
      <DashboardInner />
    </RequireAdmin>
  );
}

function DashboardInner() {
  const [counts, setCounts] = useState<Counts | null>(null);
  const [recentFamilies, setRecentFamilies] = useState<AdminFamily[]>([]);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const { counts, recentFamilies } = await api.adminDashboard();
        setCounts(counts);
        setRecentFamilies(recentFamilies);
      } finally {
        setBusy(false);
      }
    })();
  }, []);

  return (
    <AdminShell title="ダッシュボード">
      <h1 style={{ marginTop: 0 }}>ダッシュボード</h1>
      {busy || !counts ? (
        <p className="muted loading-dot">読み込み中…</p>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
            gap: 12,
            marginBottom: 24,
          }}
        >
          {(Object.keys(kpiLabel) as (keyof Counts)[]).map((k) => (
            <div key={k} className="panel" style={{ textAlign: "center" }}>
              <div className="hint">{kpiLabel[k]}</div>
              <div
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "1.8rem",
                  fontWeight: 700,
                  color: "var(--teal-deep)",
                }}
              >
                {counts[k].toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      )}

      <section className="panel">
        <h2>最近作成された Family</h2>
        {recentFamilies.length === 0 ? (
          <p className="hint">Familyがありません</p>
        ) : (
          <ul className="clean stack">
            {recentFamilies.map((f) => (
              <li
                key={f.id}
                className="row"
                style={{ justifyContent: "space-between" }}
              >
                <Link href={`/admin/families/${f.id}`}>
                  <strong>{f.name || "（無題の家族）"}</strong>
                  <span className="hint"> ・ {f.createdAt.slice(0, 10)}</span>
                </Link>
                <div className="row" style={{ gap: 6 }}>
                  {f.isDemo ? <span className="badge">デモ</span> : null}
                  {f.isSuspended ? (
                    <span className="badge badge-danger">停止中</span>
                  ) : (
                    <span className="badge badge-ok">有効</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </AdminShell>
  );
}
