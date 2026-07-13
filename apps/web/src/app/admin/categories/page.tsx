"use client";

import { FormEvent, useEffect, useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import { RequireAdmin } from "@/components/RequireAdmin";
import { api, ApiError, type Category } from "@/lib/api";

export default function AdminCategoriesPage() {
  return (
    <RequireAdmin>
      <CategoriesInner />
    </RequireAdmin>
  );
}

function CategoriesInner() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [sortOrder, setSortOrder] = useState(100);
  const [creating, setCreating] = useState(false);

  async function load() {
    setBusy(true);
    try {
      const { categories } = await api.adminListCategories();
      setCategories(categories);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError("");
    try {
      await api.adminCreateCategory({ code, name, sortOrder });
      setCode("");
      setName("");
      setSortOrder(100);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "作成に失敗しました");
    } finally {
      setCreating(false);
    }
  }

  async function onPatch(
    c: Category,
    patch: { name?: string; sortOrder?: number; isActive?: boolean },
  ) {
    setError("");
    try {
      await api.adminPatchCategory(c.id, patch);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "更新に失敗しました");
    }
  }

  return (
    <AdminShell title="カテゴリ管理">
      <h1 style={{ marginTop: 0 }}>カテゴリ管理</h1>
      {error ? <p className="error">{error}</p> : null}

      {busy ? (
        <p className="muted loading-dot">読み込み中…</p>
      ) : (
        <div className="panel" style={{ overflowX: "auto", marginBottom: 16 }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th>コード</th>
                <th>名前</th>
                <th>並び順</th>
                <th>状態</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((c) => (
                <tr key={c.id}>
                  <td>{c.code}</td>
                  <td>
                    <input
                      defaultValue={c.name}
                      onBlur={(e) => {
                        const v = e.target.value.trim();
                        if (v && v !== c.name) onPatch(c, { name: v });
                      }}
                      style={{
                        border: "1px solid var(--line)",
                        borderRadius: 8,
                        padding: "6px 8px",
                        width: 140,
                      }}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      defaultValue={c.sortOrder}
                      onBlur={(e) => {
                        const v = Number(e.target.value);
                        if (Number.isFinite(v) && v !== c.sortOrder) {
                          onPatch(c, { sortOrder: v });
                        }
                      }}
                      style={{
                        border: "1px solid var(--line)",
                        borderRadius: 8,
                        padding: "6px 8px",
                        width: 70,
                      }}
                    />
                  </td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => void onPatch(c, { isActive: !c.isActive })}
                    >
                      {c.isActive ? "有効" : "無効"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <form className="panel" onSubmit={onCreate}>
        <h2>カテゴリを追加</h2>
        <div className="field">
          <label htmlFor="code">コード（英数字）</label>
          <input
            id="code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="例: main"
            required
          />
        </div>
        <div className="field">
          <label htmlFor="name">名前</label>
          <input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例: 主菜"
            required
          />
        </div>
        <div className="field">
          <label htmlFor="sortOrder">並び順（小さいほど先）</label>
          <input
            id="sortOrder"
            type="number"
            value={sortOrder}
            onChange={(e) => setSortOrder(Number(e.target.value) || 0)}
          />
        </div>
        <button className="btn" disabled={creating}>
          {creating ? "作成中…" : "追加する"}
        </button>
      </form>
    </AdminShell>
  );
}
