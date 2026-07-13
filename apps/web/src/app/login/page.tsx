"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export default function LoginPage() {
  const { setUser } = useAuth();
  const router = useRouter();
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { user } = await api.login(loginId, password);
      setUser(user);
      router.replace("/home");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "ログインに失敗しました");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container" style={{ paddingTop: 48 }}>
      <p className="brand" style={{ fontSize: "1.6rem" }}>
        家庭料理ログ
      </p>
      <h1>ログイン</h1>
      <p className="hint" style={{ marginBottom: 20 }}>
        デモ: <code>demo</code> / <code>demo1234</code>
      </p>
      <form className="panel" onSubmit={onSubmit}>
        <div className="field">
          <label htmlFor="loginId">ログインID</label>
          <input
            id="loginId"
            value={loginId}
            onChange={(e) => setLoginId(e.target.value)}
            autoComplete="username"
            required
          />
        </div>
        <div className="field">
          <label htmlFor="password">パスワード</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </div>
        {error ? <p className="error">{error}</p> : null}
        <button className="btn btn-block" disabled={busy}>
          {busy ? "確認中…" : "ログイン"}
        </button>
      </form>
      <p className="hint" style={{ marginTop: 16 }}>
        初めての方は <Link href="/register">親ユーザー登録</Link>
      </p>
    </div>
  );
}
