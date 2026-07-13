"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAdminAuth } from "@/lib/admin-auth";

export function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { admin, loading } = useAdminAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !admin) router.replace("/admin/login");
  }, [loading, admin, router]);

  if (loading) {
    return (
      <div className="container" style={{ paddingTop: 80 }}>
        <p className="muted loading-dot">読み込み中…</p>
      </div>
    );
  }
  if (!admin) return null;
  return <>{children}</>;
}
