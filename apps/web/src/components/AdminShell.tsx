"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAdminAuth } from "@/lib/admin-auth";
import styles from "./AdminShell.module.css";

const links = [
  { href: "/admin", label: "ダッシュボード" },
  { href: "/admin/families", label: "Family" },
  { href: "/admin/users", label: "ユーザー" },
  { href: "/admin/categories", label: "カテゴリ" },
  { href: "/admin/audit", label: "監査ログ" },
  { href: "/admin/health", label: "ヘルス" },
];

export function AdminShell({
  children,
  title,
}: {
  children: React.ReactNode;
  title?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { admin, logout } = useAdminAuth();

  return (
    <div className={`${styles.shell} container`}>
      <header className={styles.header}>
        <div className={styles.headerRow}>
          <div>
            <Link href="/admin" className={`brand ${styles.brand}`}>
              tsukutta・管理
            </Link>
            {title ? <p className={styles.pageTitle}>{title}</p> : null}
          </div>
          <div className="row" style={{ gap: 10 }}>
            {admin ? <span className="hint">{admin.loginId}</span> : null}
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() =>
                void logout().then(() => router.replace("/admin/login"))
              }
            >
              ログアウト
            </button>
          </div>
        </div>
        <nav className={styles.nav} aria-label="管理メニュー">
          {links.map((l) => {
            const active =
              l.href === "/admin"
                ? pathname === "/admin"
                : pathname === l.href || pathname.startsWith(`${l.href}/`);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`${styles.navItem} ${active ? styles.active : ""}`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
      </header>
      <main className="fade-in">{children}</main>
    </div>
  );
}
