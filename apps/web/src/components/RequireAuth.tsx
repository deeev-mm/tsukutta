"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  if (loading) {
    return (
      <div className="container" style={{ paddingTop: 80 }}>
        <p className="muted loading-dot">読み込み中…</p>
      </div>
    );
  }
  if (!user) return null;
  return <>{children}</>;
}
