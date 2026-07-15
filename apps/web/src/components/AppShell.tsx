"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./AppShell.module.css";

const links = [
  { href: "/home", label: "ホーム" },
  { href: "/recipes", label: "レシピ" },
  { href: "/timeline", label: "記録" },
  { href: "/shopping-list", label: "買い物" },
  { href: "/calendar", label: "暦" },
  { href: "/rankings", label: "見返し" },
  { href: "/settings", label: "設定" },
];

export function AppShell({
  children,
  title,
}: {
  children: React.ReactNode;
  title?: string;
}) {
  const pathname = usePathname();

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className="container">
          <Link href="/home" className={`brand ${styles.brand}`}>
            tsukutta
          </Link>
          {title ? <p className={styles.pageTitle}>{title}</p> : null}
        </div>
      </header>
      <main className={`container fade-in`}>{children}</main>
      <nav className={styles.nav} aria-label="メインナビ">
        {links.map((l) => {
          const active =
            pathname === l.href || pathname.startsWith(`${l.href}/`);
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
    </div>
  );
}
