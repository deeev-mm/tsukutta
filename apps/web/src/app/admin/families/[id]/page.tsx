"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { AdminShell } from "@/components/AdminShell";
import { RequireAdmin } from "@/components/RequireAdmin";
import { api, ApiError, type AdminFamily, type FamilyUser } from "@/lib/api";
import { IconArrowLeft } from "@/components/icons";

const roleLabel: Record<string, string> = {
  owner: "親",
  cook: "調理者",
  reviewer: "閲覧のみ",
};

export default function AdminFamilyDetailPage() {
  return (
    <RequireAdmin>
      <FamilyDetailInner />
    </RequireAdmin>
  );
}

function FamilyDetailInner() {
  const params = useParams<{ id: string }>();
  const [family, setFamily] = useState<AdminFamily | null>(null);
  const [members, setMembers] = useState<FamilyUser[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(true);

  async function load() {
    setBusy(true);
    try {
      const { family, members } = await api.adminGetFamily(params.id);
      setFamily(family);
      setMembers(members);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "読み込みに失敗しました");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  async function onToggleSuspend() {
    if (!family) return;
    setError("");
    try {
      if (family.isSuspended) {
        await api.adminResumeFamily(family.id);
      } else {
        await api.adminSuspendFamily(family.id);
      }
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "更新に失敗しました");
    }
  }

  return (
    <AdminShell title="Family詳細">
      <p className="hint">
        <Link href="/admin/families">
          <IconArrowLeft /> Family一覧へ
        </Link>
      </p>
      {error ? <p className="error">{error}</p> : null}
      {busy || !family ? (
        <p className="muted loading-dot">読み込み中…</p>
      ) : (
        <>
          <div
            className="row"
            style={{ justifyContent: "space-between", marginTop: 12 }}
          >
            <h1 style={{ margin: 0 }}>{family.name || "（無題の家族）"}</h1>
            {family.isSuspended ? (
              <span className="badge badge-danger">停止中</span>
            ) : (
              <span className="badge badge-ok">有効</span>
            )}
          </div>

          <section className="panel" style={{ marginTop: 16, marginBottom: 16 }}>
            <h2>概要</h2>
            <dl className="stack" style={{ gap: 6 }}>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <dt className="muted">家族人数</dt>
                <dd style={{ margin: 0 }}>{family.householdSize}</dd>
              </div>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <dt className="muted">デモ</dt>
                <dd style={{ margin: 0 }}>{family.isDemo ? "はい" : "いいえ"}</dd>
              </div>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <dt className="muted">作成日</dt>
                <dd style={{ margin: 0 }}>{family.createdAt.slice(0, 10)}</dd>
              </div>
            </dl>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ marginTop: 14 }}
              onClick={() => void onToggleSuspend()}
            >
              {family.isSuspended ? "利用を再開する" : "利用を停止する"}
            </button>
          </section>

          <section className="panel">
            <h2>メンバー</h2>
            {members.length === 0 ? (
              <p className="hint">メンバーがいません</p>
            ) : (
              <ul className="clean stack">
                {members.map((m) => (
                  <li
                    key={m.id}
                    className="row"
                    style={{ justifyContent: "space-between" }}
                  >
                    <div>
                      <strong>{m.displayName}</strong>
                      <span className="hint"> （{m.loginId}）</span>
                    </div>
                    <div className="row" style={{ gap: 6 }}>
                      <span className="badge">{roleLabel[m.role] ?? m.role}</span>
                      {!m.isActive ? (
                        <span className="badge badge-danger">無効</span>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </AdminShell>
  );
}
