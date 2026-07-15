"use client";

import { FormEvent, useEffect, useState } from "react";
import { GROQ_API_KEY_URL } from "@tsukutta/shared";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { api, ApiError, type Category, type FamilyUser } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useGroqKey } from "@/lib/groq-key";

const roleLabel: Record<string, string> = {
  owner: "親",
  cook: "調理者",
  reviewer: "閲覧のみ",
};

const roleBadgeClass: Record<string, string> = {
  owner: "badge badge-owner",
  cook: "badge badge-cook",
  reviewer: "badge badge-reviewer",
};

function FamilyMembers() {
  const [members, setMembers] = useState<FamilyUser[]>([]);
  const [busy, setBusy] = useState(true);
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState<"cook" | "reviewer">("cook");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    setBusy(true);
    try {
      const { users } = await api.listFamilyUsers();
      setMembers(users);
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
    setMessage("");
    try {
      await api.createFamilyUser({ loginId, password, displayName, role });
      setLoginId("");
      setPassword("");
      setDisplayName("");
      setRole("cook");
      setMessage("メンバーを追加しました");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "追加に失敗しました");
    } finally {
      setCreating(false);
    }
  }

  async function onToggleActive(m: FamilyUser) {
    setError("");
    try {
      await api.patchFamilyUser(m.id, { isActive: !m.isActive });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "更新に失敗しました");
    }
  }

  async function onChangeRole(m: FamilyUser, next: "cook" | "reviewer") {
    setError("");
    try {
      await api.patchFamilyUser(m.id, { role: next });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "更新に失敗しました");
    }
  }

  return (
    <div className="panel" style={{ marginTop: 16 }}>
      <h2>家族のメンバー</h2>
      <p className="hint" style={{ marginBottom: 12 }}>
        調理者（レシピ登録・記録）または閲覧のみ（評価・コメントのみ可）のアカウントを追加できます。
      </p>

      {busy ? (
        <p className="muted loading-dot">読み込み中…</p>
      ) : members.length === 0 ? (
        <p className="hint">まだメンバーがいません</p>
      ) : (
        <ul className="clean stack" style={{ marginBottom: 18 }}>
          {members.map((m) => (
            <li
              key={m.id}
              className="row"
              style={{
                justifyContent: "space-between",
                border: "1px solid var(--line)",
                borderRadius: 12,
                padding: "10px 12px",
              }}
            >
              <div>
                <div className="row" style={{ gap: 8 }}>
                  <strong>{m.displayName}</strong>
                  <span className={roleBadgeClass[m.role] ?? "badge"}>
                    {roleLabel[m.role] ?? m.role}
                  </span>
                  {!m.isActive ? (
                    <span className="badge badge-danger">無効</span>
                  ) : null}
                </div>
                <div className="hint">{m.loginId}</div>
              </div>
              <div className="row">
                {m.role !== "owner" ? (
                  <select
                    value={m.role}
                    onChange={(e) =>
                      void onChangeRole(m, e.target.value as "cook" | "reviewer")
                    }
                    style={{
                      border: "1px solid var(--line)",
                      borderRadius: 10,
                      padding: "6px 8px",
                      background: "rgba(255,255,255,0.85)",
                    }}
                  >
                    <option value="cook">調理者</option>
                    <option value="reviewer">閲覧のみ</option>
                  </select>
                ) : null}
                {m.role !== "owner" ? (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => void onToggleActive(m)}
                  >
                    {m.isActive ? "無効化" : "有効化"}
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={onCreate}>
        <h3 style={{ fontFamily: "var(--font-display)", marginBottom: 10 }}>
          メンバーを追加
        </h3>
        <div className="field">
          <label htmlFor="newLoginId">ログインID</label>
          <input
            id="newLoginId"
            value={loginId}
            onChange={(e) => setLoginId(e.target.value)}
            minLength={2}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="newPassword">パスワード（4文字以上）</label>
          <input
            id="newPassword"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={4}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="newDisplayName">表示名</label>
          <input
            id="newDisplayName"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="例: おばあちゃん"
          />
        </div>
        <div className="field">
          <label htmlFor="newRole">ロール</label>
          <select
            id="newRole"
            value={role}
            onChange={(e) => setRole(e.target.value as "cook" | "reviewer")}
          >
            <option value="cook">調理者（レシピ登録・記録ができる）</option>
            <option value="reviewer">閲覧のみ（評価・コメントのみ）</option>
          </select>
        </div>
        {error ? <p className="error">{error}</p> : null}
        {message ? <p className="hint">{message}</p> : null}
        <button className="btn" disabled={creating}>
          {creating ? "追加中…" : "追加する"}
        </button>
      </form>
    </div>
  );
}

function CategoryMaster() {
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
      const { categories } = await api.listCategoriesForManage();
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
      await api.createCategory({ code, name, sortOrder });
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
      await api.patchCategory(c.id, patch);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "更新に失敗しました");
    }
  }

  return (
    <div className="panel" style={{ marginTop: 16 }}>
      <h2>料理カテゴリ</h2>
      <p className="hint" style={{ marginBottom: 12 }}>
        レシピの分類に使う共通マスタです。追加・名前変更・並び・有効/無効ができます。
        無効にすると新規の付与はできなくなります（既存の紐づけは残ります）。
      </p>
      {error ? <p className="error">{error}</p> : null}
      {busy ? (
        <p className="muted loading-dot">読み込み中…</p>
      ) : (
        <div style={{ overflowX: "auto", marginBottom: 16 }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th>コード</th>
                <th>名前</th>
                <th>並び</th>
                <th>状態</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((c) => (
                <tr key={c.id}>
                  <td>
                    <code>{c.code}</code>
                  </td>
                  <td>
                    <input
                      defaultValue={c.name}
                      onBlur={(e) => {
                        const v = e.target.value.trim();
                        if (v && v !== c.name) void onPatch(c, { name: v });
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
                          void onPatch(c, { sortOrder: v });
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

      <form onSubmit={onCreate}>
        <h3 style={{ marginTop: 0, fontSize: "1rem" }}>カテゴリを追加</h3>
        <div className="field">
          <label htmlFor="catCode">コード（英数字）</label>
          <input
            id="catCode"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="例: side"
            required
          />
        </div>
        <div className="field">
          <label htmlFor="catName">名前</label>
          <input
            id="catName"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例: 副菜"
            required
          />
        </div>
        <div className="field">
          <label htmlFor="catSort">並び順（小さいほど先）</label>
          <input
            id="catSort"
            type="number"
            value={sortOrder}
            onChange={(e) => setSortOrder(Number(e.target.value) || 0)}
          />
        </div>
        <button className="btn" disabled={creating}>
          {creating ? "追加中…" : "追加する"}
        </button>
      </form>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <RequireAuth>
      <SettingsInner />
    </RequireAuth>
  );
}

function SettingsInner() {
  const { user, setUser, logout, refresh } = useAuth();
  const { key, setKey, clear, hasKey } = useGroqKey();
  const [familyName, setFamilyName] = useState(user?.familyName ?? "");
  const [householdSize, setHouseholdSize] = useState(user?.householdSize ?? 2);
  const [groqDraft, setGroqDraft] = useState(key);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setFamilyName(user?.familyName ?? "");
    setHouseholdSize(user?.householdSize ?? 2);
  }, [user]);

  useEffect(() => {
    setGroqDraft(key);
  }, [key]);

  async function onSaveFamily(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const { family } = await api.patchFamily({
        name: familyName || null,
        householdSize,
      });
      await refresh();
      setUser(
        user
          ? {
              ...user,
              familyName: family.name,
              householdSize: family.householdSize,
            }
          : user,
      );
      setMessage("家族設定を保存しました");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "保存に失敗しました");
    } finally {
      setBusy(false);
    }
  }

  function onSaveGroq(e: FormEvent) {
    e.preventDefault();
    if (!groqDraft.trim()) {
      setError("APIキーを入力してください");
      return;
    }
    setKey(groqDraft);
    setError("");
    setMessage(
      "Groq APIキーをこの端末の localStorage に保存しました（サーバーには送りません）",
    );
  }

  return (
    <AppShell title="設定">
      <h1 style={{ marginTop: 12 }}>設定</h1>
      <p className="hint">
        {user?.displayName}（{user?.loginId}）・ロール: {user?.role}
        {user?.isDemo ? " ・デモ Family" : ""}
      </p>

      {user?.role === "owner" ? <FamilyMembers /> : null}
      {user?.role === "owner" || user?.role === "cook" ? <CategoryMaster /> : null}

      <form className="panel" style={{ marginTop: 16 }} onSubmit={onSaveFamily}>
        <h2>家族構成</h2>
        <div className="field">
          <label htmlFor="familyName">家族の呼び名</label>
          <input
            id="familyName"
            value={familyName}
            onChange={(e) => setFamilyName(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="householdSize">家族人数（分量換算の標準）</label>
          <input
            id="householdSize"
            type="number"
            min={1}
            value={householdSize}
            onChange={(e) => setHouseholdSize(Number(e.target.value) || 1)}
            required
          />
        </div>
        <button className="btn" disabled={busy || user?.role !== "owner"}>
          保存
        </button>
      </form>

      <form className="panel" style={{ marginTop: 16 }} onSubmit={onSaveGroq}>
        <h2>Groq APIキー</h2>
        <p className="hint" style={{ marginBottom: 12 }}>
          キーはサーバーに送って保存せず、このブラウザの{" "}
          <code>localStorage</code> にだけ残します。
          {hasKey ? " （この端末に保存済み）" : " （未設定）"}
          {user?.isDemo ? " ※デモ Family も同じ扱いです。" : ""}
        </p>
        <p className="hint" style={{ marginBottom: 12 }}>
          キーの発行:{" "}
          <a href={GROQ_API_KEY_URL} target="_blank" rel="noreferrer">
            Groq Console（APIキー）
          </a>
        </p>
        <div className="notice">
          AI整形では入力したテキストを Groq API に送信します。
          提供元側で処理・学習等に利用される可能性があります。
          <strong>
            個人情報・秘密にしたい内容・学習されて困る文章は入力しないでください。
          </strong>
          <br />
          共用PCでは localStorage にキーが残る点にご注意ください。
        </div>
        <div className="field">
          <label htmlFor="groq">APIキー</label>
          <input
            id="groq"
            type="password"
            value={groqDraft}
            onChange={(e) => setGroqDraft(e.target.value)}
            placeholder="gsk_..."
            autoComplete="off"
          />
        </div>
        <div className="row">
          <button className="btn" type="submit">
            localStorage に保存
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              clear();
              setGroqDraft("");
              setMessage("APIキーを localStorage から削除しました");
            }}
          >
            削除
          </button>
        </div>
      </form>

      {message ? <p className="hint" style={{ marginTop: 12 }}>{message}</p> : null}
      {error ? <p className="error">{error}</p> : null}

      <button
        type="button"
        className="btn btn-secondary btn-block"
        style={{ marginTop: 24 }}
        onClick={() => void logout().then(() => (window.location.href = "/login"))}
      >
        ログアウト
      </button>
    </AppShell>
  );
}
