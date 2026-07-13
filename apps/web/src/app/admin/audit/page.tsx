"use client";

import { useEffect, useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import { RequireAdmin } from "@/components/RequireAdmin";
import { api, type AdminAuditLog } from "@/lib/api";

export default function AdminAuditPage() {
  return (
    <RequireAdmin>
      <AuditInner />
    </RequireAdmin>
  );
}

function AuditInner() {
  const [logs, setLogs] = useState<AdminAuditLog[]>([]);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const { auditLogs } = await api.adminAuditLogs();
        setLogs(auditLogs);
      } finally {
        setBusy(false);
      }
    })();
  }, []);

  return (
    <AdminShell title="監査ログ">
      <h1 style={{ marginTop: 0 }}>監査ログ</h1>
      <p className="hint" style={{ marginBottom: 16 }}>
        直近100件の管理操作を表示しています。
      </p>
      {busy ? (
        <p className="muted loading-dot">読み込み中…</p>
      ) : logs.length === 0 ? (
        <p className="hint">ログがありません</p>
      ) : (
        <ul className="clean stack">
          {logs.map((l) => (
            <li key={l.id} className="panel">
              <div className="row" style={{ justifyContent: "space-between" }}>
                <strong>{l.action}</strong>
                <span className="hint">{l.createdAt}</span>
              </div>
              <div className="hint" style={{ marginTop: 4 }}>
                管理者: {l.adminLoginId}
                {l.targetType ? ` ・ 対象: ${l.targetType}` : ""}
                {l.targetId ? ` (${l.targetId})` : ""}
              </div>
              {l.detailJson ? (
                <pre
                  style={{
                    marginTop: 8,
                    fontSize: "0.75rem",
                    whiteSpace: "pre-wrap",
                    color: "var(--ink-muted)",
                  }}
                >
                  {l.detailJson}
                </pre>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </AdminShell>
  );
}
