"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import { RequireAdmin } from "@/components/RequireAdmin";
import { api, ApiError, type AdminFamily } from "@/lib/api";

export default function AdminFamiliesPage() {
  return (
    <RequireAdmin>
      <FamiliesInner />
    </RequireAdmin>
  );
}

function FamiliesInner() {
  const [q, setQ] = useState("");
  const [families, setFamilies] = useState<AdminFamily[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");

  async function load(search?: string) {
    setBusy(true);
    try {
      const { families } = await api.adminListFamilies(search);
      setFamilies(families);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function onSearch(e: FormEvent) {
    e.preventDefault();
    void load(q.trim() || undefined);
  }

  async function onToggleSuspend(f: AdminFamily) {
    setError("");
    try {
      if (f.isSuspended) {
        await api.adminResumeFamily(f.id);
      } else {
        await api.adminSuspendFamily(f.id);
      }
      await load(q.trim() || undefined);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "更新に失敗しました");
    }
  }

  return (
    <AdminShell title="Family一覧">
      <h1 style={{ marginTop: 0 }}>Family一覧</h1>

      <form className="row" onSubmit={onSearch} style={{ marginBottom: 16 }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Family名で検索"
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

      {error ? <p className="error">{error}</p> : null}

      {busy ? (
        <p className="muted loading-dot">読み込み中…</p>
      ) : families.length === 0 ? (
        <p className="hint">Familyがありません</p>
      ) : (
        <div className="panel" style={{ overflowX: "auto" }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th>名前</th>
                <th>人数</th>
                <th>ユーザー</th>
                <th>レシピ</th>
                <th>状態</th>
                <th>作成日</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {families.map((f) => (
                <tr key={f.id}>
                  <td>
                    <Link href={`/admin/families/${f.id}`}>
                      <strong>{f.name || "（無題）"}</strong>
                    </Link>
                    {f.isDemo ? (
                      <span className="badge" style={{ marginLeft: 6 }}>
                        デモ
                      </span>
                    ) : null}
                  </td>
                  <td>{f.householdSize}</td>
                  <td>{f.userCount ?? "-"}</td>
                  <td>{f.recipeCount ?? "-"}</td>
                  <td>
                    {f.isSuspended ? (
                      <span className="badge badge-danger">停止中</span>
                    ) : (
                      <span className="badge badge-ok">有効</span>
                    )}
                  </td>
                  <td>{f.createdAt.slice(0, 10)}</td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => void onToggleSuspend(f)}
                    >
                      {f.isSuspended ? "再開" : "停止"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminShell>
  );
}
