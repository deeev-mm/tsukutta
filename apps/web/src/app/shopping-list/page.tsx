"use client";

import { FormEvent, useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { api, ApiError, type ShoppingListItem } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export default function ShoppingListPage() {
  return (
    <RequireAuth>
      <ShoppingListInner />
    </RequireAuth>
  );
}

function ShoppingListInner() {
  const { user } = useAuth();
  const isReviewer = user?.role === "reviewer";
  const [items, setItems] = useState<ShoppingListItem[]>([]);
  const [busy, setBusy] = useState(true);
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  async function load() {
    setBusy(true);
    try {
      const { items } = await api.listShoppingList();
      setItems(items);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function onAdd(e: FormEvent) {
    e.preventDefault();
    const v = name.trim();
    if (!v) return;
    setError("");
    try {
      await api.addShoppingListItem(v);
      setName("");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "追加に失敗しました");
    }
  }

  async function onToggle(item: ShoppingListItem) {
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, isChecked: !i.isChecked } : i)),
    );
    try {
      await api.updateShoppingListItem(item.id, { isChecked: !item.isChecked });
    } finally {
      await load();
    }
  }

  async function onDelete(item: ShoppingListItem) {
    await api.deleteShoppingListItem(item.id);
    await load();
  }

  async function onClearChecked() {
    if (!checkedCount) return;
    if (!confirm("チェック済みの品目をすべて削除しますか？")) return;
    await api.clearCheckedShoppingListItems();
    await load();
  }

  const unchecked = items.filter((i) => !i.isChecked);
  const checked = items.filter((i) => i.isChecked);
  const checkedCount = checked.length;

  return (
    <AppShell title="買い物リスト">
      <h1 style={{ marginTop: 12 }}>買い物リスト</h1>
      <p className="hint" style={{ marginBottom: 16 }}>
        {isReviewer
          ? "家族で共有される買い物リストです。追加・削除・チェックは調理者が行います。"
          : "家族で共有される1本のリストです。レシピ詳細から材料をまとめて追加できます。"}
      </p>

      {!isReviewer ? (
        <form className="row" onSubmit={onAdd} style={{ marginBottom: 16 }}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="品目を追加（例: 牛乳）"
            style={{
              flex: 1,
              minWidth: 160,
              border: "1px solid var(--line)",
              borderRadius: 12,
              padding: "12px 14px",
              background: "rgba(255,255,255,0.85)",
            }}
          />
          <button className="btn" type="submit">
            追加
          </button>
        </form>
      ) : null}

      {error ? <p className="error">{error}</p> : null}

      {busy ? (
        <p className="muted loading-dot">読み込み中…</p>
      ) : items.length === 0 ? (
        <p className="hint">買い物リストは空です</p>
      ) : (
        <>
          <section className="panel" style={{ marginBottom: 14 }}>
            {unchecked.length === 0 ? (
              <p className="hint">未チェックの品目はありません</p>
            ) : (
              <ul className="clean stack">
                {unchecked.map((item) => (
                  <li key={item.id} className="row" style={{ justifyContent: "space-between" }}>
                    {isReviewer ? (
                      <span>{item.name}</span>
                    ) : (
                      <>
                        <label className="row" style={{ gap: 10, flex: 1 }}>
                          <input
                            type="checkbox"
                            checked={item.isChecked}
                            onChange={() => void onToggle(item)}
                          />
                          <span>{item.name}</span>
                        </label>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => void onDelete(item)}
                        >
                          削除
                        </button>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {checked.length > 0 ? (
            <section className="panel">
              <div className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
                <h2 style={{ margin: 0 }}>買った物</h2>
                {!isReviewer ? (
                  <button type="button" className="btn btn-secondary" onClick={() => void onClearChecked()}>
                    まとめて削除
                  </button>
                ) : null}
              </div>
              <ul className="clean stack">
                {checked.map((item) => (
                  <li key={item.id} className="row" style={{ justifyContent: "space-between" }}>
                    {isReviewer ? (
                      <span className="muted" style={{ textDecoration: "line-through" }}>
                        {item.name}
                      </span>
                    ) : (
                      <>
                        <label className="row" style={{ gap: 10, flex: 1 }}>
                          <input
                            type="checkbox"
                            checked={item.isChecked}
                            onChange={() => void onToggle(item)}
                          />
                          <span className="muted" style={{ textDecoration: "line-through" }}>
                            {item.name}
                          </span>
                        </label>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => void onDelete(item)}
                        >
                          削除
                        </button>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      )}
    </AppShell>
  );
}
