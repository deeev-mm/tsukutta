"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import styles from "./page.module.css";

export default function LandingPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) router.replace("/home");
  }, [loading, user, router]);

  return (
    <div className={styles.hero}>
      <div className={styles.veil} />
      <div className={`container ${styles.content} fade-in`}>
        <p className={`brand ${styles.brand}`}>家庭料理ログ</p>
        <h1 className={styles.headline}>うちの版として残す、家族のレシピ帳</h1>
        <p className={styles.lead}>
          出典を控え、コピペをAIで整え、作った日と一言を家族の記録に。
        </p>
        <div className={styles.cta}>
          <Link href="/login" className="btn">
            ログイン
          </Link>
          <Link href="/register" className="btn btn-secondary">
            親ユーザー登録
          </Link>
        </div>
        <p style={{ marginTop: 32, opacity: 0.6, fontSize: "0.78rem" }}>
          <Link href="/admin/login">管理者ログイン</Link>
        </p>
      </div>
    </div>
  );
}
