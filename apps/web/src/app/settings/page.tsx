"use client";

import { FormEvent, useEffect, useState } from "react";
import { GROQ_API_KEY_URL } from "@pf08/shared";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useGroqKey } from "@/lib/groq-key";

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
