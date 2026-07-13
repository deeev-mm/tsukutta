"use client";

import { useEffect, useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import { RequireAdmin } from "@/components/RequireAdmin";
import { api } from "@/lib/api";

export default function AdminHealthPage() {
  return (
    <RequireAdmin>
      <HealthInner />
    </RequireAdmin>
  );
}

function HealthInner() {
  const [health, setHealth] = useState<{ ok: boolean; db: boolean } | null>(
    null,
  );
  const [busy, setBusy] = useState(true);
  const [checkedAt, setCheckedAt] = useState<string>("");

  async function check() {
    setBusy(true);
    try {
      const result = await api.adminHealth();
      setHealth(result);
    } catch {
      setHealth({ ok: false, db: false });
    } finally {
      setCheckedAt(new Date().toLocaleString("ja-JP"));
      setBusy(false);
    }
  }

  useEffect(() => {
    void check();
  }, []);

  return (
    <AdminShell title="ヘルスチェック">
      <h1 style={{ marginTop: 0 }}>ヘルスチェック</h1>
      <div className="panel">
        {busy ? (
          <p className="muted loading-dot">確認中…</p>
        ) : (
          <>
            <div className="row" style={{ gap: 10, marginBottom: 8 }}>
              <span className="muted">API / DB</span>
              {health?.ok ? (
                <span className="badge badge-ok">正常</span>
              ) : (
                <span className="badge badge-danger">異常</span>
              )}
            </div>
            <p className="hint">最終確認: {checkedAt}</p>
          </>
        )}
        <button
          type="button"
          className="btn btn-secondary"
          style={{ marginTop: 12 }}
          onClick={() => void check()}
        >
          再チェック
        </button>
      </div>
    </AdminShell>
  );
}
