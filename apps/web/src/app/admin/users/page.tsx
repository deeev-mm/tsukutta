"use client";

import { FormEvent, useEffect, useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import { RequireAdmin } from "@/components/RequireAdmin";
import { api, ApiError, type AdminUser } from "@/lib/api";

const roleLabel: Record<string, string> = {
  owner: "親",
  cook: "調理者",
  reviewer: "閲覧のみ",
};

export default function AdminUsersPage() {
  return (
    <RequireAdmin>
      <UsersInner />
    </RequireAdmin>
  );
}

function UsersInner() {
  const [q, setQ] = useState("");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");

  async function load(search?: string) {
    setBusy(true);
    try {
      const { users } = await api.adminListUsers(search);
      setUsers(users);
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

  async function onToggleActive(u: AdminUser) {
    setError("");
    try {
      if (u.isActive) {
        await api.adminDisableUser(u.id);
      } else {
        await api.adminEnableUser(u.id);
      }
      await load(q.trim() || undefined);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "更新に失敗しました");
    }
  }

  async function onResetPassword(u: AdminUser) {
    setError("");
    try {
      const { temporaryPassword } = await api.adminResetPassword(u.id);
      alert(
        `${u.displayName}（${u.loginId}）の仮パスワード:\n${temporaryPassword}\n\nこの内容は今だけ表示されます。ユーザーに安全な方法で伝えてください。`,
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "パスワード再発行に失敗しました");
    }
  }

  return (
    <AdminShell title="ユーザー管理">
      <h1 style={{ marginTop: 0 }}>ユーザー管理</h1>

      <form className="row" onSubmit={onSearch} style={{ marginBottom: 16 }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="ログインID・表示名で検索"
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
      ) : users.length === 0 ? (
        <p className="hint">ユーザーがいません</p>
      ) : (
        <div className="panel" style={{ overflowX: "auto" }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th>ログインID</th>
                <th>表示名</th>
                <th>Family</th>
                <th>ロール</th>
                <th>状態</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.loginId}</td>
                  <td>{u.displayName}</td>
                  <td>{u.familyName}</td>
                  <td>{roleLabel[u.role] ?? u.role}</td>
                  <td>
                    {u.isActive ? (
                      <span className="badge badge-ok">有効</span>
                    ) : (
                      <span className="badge badge-danger">無効</span>
                    )}
                  </td>
                  <td>
                    <div className="row" style={{ gap: 6, flexWrap: "nowrap" }}>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => void onToggleActive(u)}
                      >
                        {u.isActive ? "無効化" : "有効化"}
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => void onResetPassword(u)}
                      >
                        PW再発行
                      </button>
                    </div>
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
