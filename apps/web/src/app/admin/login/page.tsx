"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { useAdminAuth } from "@/lib/admin-auth";

export default function AdminLoginPage() {
  const { admin, loading, setAdmin } = useAdminAuth();
  const router = useRouter();
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && admin) router.replace("/admin");
  }, [loading, admin, router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { admin } = await api.adminLogin(loginId, password);
      setAdmin(admin);
      router.replace("/admin");
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "ログインに失敗しました",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container" style={{ paddingTop: 48 }}>
      <p className="brand" style={{ fontSize: "1.4rem" }}>
        家庭料理ログ・管理
      </p>
      <h1>管理者ログイン</h1>
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
        <Link href="/">トップへ戻る</Link>
      </p>
    </div>
  );
}
