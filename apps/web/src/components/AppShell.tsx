"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./AppShell.module.css";
import {
  IconBook,
  IconCalendarDays,
  IconClipboardList,
  IconHome,
  IconSettingsGear,
  IconShoppingCart,
  IconTrophy,
} from "./icons";
import { useAuth } from "@/lib/auth";

const links = [
  { href: "/home", label: "ホーム", icon: IconHome },
  { href: "/recipes", label: "レシピ", icon: IconBook },
  { href: "/timeline", label: "記録", icon: IconClipboardList },
  { href: "/shopping-list", label: "買い物", icon: IconShoppingCart },
  { href: "/calendar", label: "暦", icon: IconCalendarDays },
  { href: "/rankings", label: "見返し", icon: IconTrophy },
  { href: "/settings", label: "設定", icon: IconSettingsGear },
];

const reviewerHiddenHrefs = new Set(["/recipes", "/rankings"]);

export function AppShell({
  children,
  title,
}: {
  children: React.ReactNode;
  title?: string;
}) {
  const pathname = usePathname();
  const { user } = useAuth();

  const visibleLinks =
    user?.role === "reviewer"
      ? links.filter((l) => !reviewerHiddenHrefs.has(l.href))
      : links;

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
      <nav
        className={styles.nav}
        aria-label="メインナビ"
        style={{ gridTemplateColumns: `repeat(${visibleLinks.length}, 1fr)` }}
      >
        {visibleLinks.map((l) => {
          const active =
            pathname === l.href || pathname.startsWith(`${l.href}/`);
          const Icon = l.icon;
          return (
            <Link
              key={l.href}
              href={l.href}
              className={`${styles.navItem} ${active ? styles.active : ""}`}
              aria-label={l.label}
              title={l.label}
            >
              <Icon size={22} />
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
