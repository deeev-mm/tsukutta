"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export default function RegisterPage() {
  const { setUser } = useAuth();
  const router = useRouter();
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [familyName, setFamilyName] = useState("");
  const [householdSize, setHouseholdSize] = useState(4);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { user } = await api.register({
        loginId,
        password,
        displayName: displayName || undefined,
        familyName: familyName || undefined,
        householdSize,
      });
      setUser(user);
      router.replace("/home");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "登録に失敗しました");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container" style={{ paddingTop: 48 }}>
      <p className="brand" style={{ fontSize: "1.6rem" }}>
        家庭料理ログ
      </p>
      <h1>親ユーザー登録</h1>
      <p className="hint" style={{ marginBottom: 20 }}>
        メール認証は不要です。登録と同時に家族（Family）が作成され、あなたが調理者（Owner）になります。
      </p>
      <form className="panel" onSubmit={onSubmit}>
        <div className="field">
          <label htmlFor="loginId">ログインID</label>
          <input
            id="loginId"
            value={loginId}
            onChange={(e) => setLoginId(e.target.value)}
            required
            minLength={2}
          />
        </div>
        <div className="field">
          <label htmlFor="password">パスワード（4文字以上）</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={4}
          />
        </div>
        <div className="field">
          <label htmlFor="displayName">表示名</label>
          <input
            id="displayName"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="例: パパ"
          />
        </div>
        <div className="field">
          <label htmlFor="familyName">家族の呼び名（任意）</label>
          <input
            id="familyName"
            value={familyName}
            onChange={(e) => setFamilyName(e.target.value)}
            placeholder="例: みやざき家"
          />
        </div>
        <div className="field">
          <label htmlFor="householdSize">家族人数（分量換算用）</label>
          <input
            id="householdSize"
            type="number"
            min={1}
            value={householdSize}
            onChange={(e) => setHouseholdSize(Number(e.target.value))}
            required
          />
        </div>
        {error ? <p className="error">{error}</p> : null}
        <button className="btn btn-block" disabled={busy}>
          {busy ? "作成中…" : "登録してはじめる"}
        </button>
      </form>
      <p className="hint" style={{ marginTop: 16 }}>
        すでにアカウントがある方は <Link href="/login">ログイン</Link>
      </p>
    </div>
  );
}
