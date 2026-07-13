"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { api, type CookLog } from "@/lib/api";
import styles from "./calendar.module.css";

export default function CalendarPage() {
  return (
    <RequireAuth>
      <CalendarInner />
    </RequireAuth>
  );
}

function CalendarInner() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth()); // 0-based
  const [logs, setLogs] = useState<CookLog[]>([]);

  const from = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month + 1, 0).getDate();
  const to = `${year}-${String(month + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  useEffect(() => {
    void (async () => {
      const { cookLogs } = await api.listCookLogs({ from, to });
      setLogs(cookLogs);
    })();
  }, [from, to]);

  const byDay = useMemo(() => {
    const map = new Map<string, CookLog[]>();
    for (const l of logs) {
      const arr = map.get(l.cookedAt) ?? [];
      arr.push(l);
      map.set(l.cookedAt, arr);
    }
    return map;
  }, [logs]);

  const cells = useMemo(() => {
    const first = new Date(year, month, 1);
    const startPad = (first.getDay() + 6) % 7; // Monday start
    const days: Array<{ date: string | null; day: number | null }> = [];
    for (let i = 0; i < startPad; i++) days.push({ date: null, day: null });
    for (let d = 1; d <= lastDay; d++) {
      const date = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      days.push({ date, day: d });
    }
    return days;
  }, [year, month, lastDay]);

  function prev() {
    if (month === 0) {
      setYear(year - 1);
      setMonth(11);
    } else setMonth(month - 1);
  }
  function next() {
    if (month === 11) {
      setYear(year + 1);
      setMonth(0);
    } else setMonth(month + 1);
  }

  return (
    <AppShell title="カレンダー">
      <div className="row" style={{ margin: "12px 0 16px", justifyContent: "space-between" }}>
        <h1>
          {year}年{month + 1}月
        </h1>
        <div className="row">
          <button type="button" className="btn btn-secondary" onClick={prev}>
            前
          </button>
          <button type="button" className="btn btn-secondary" onClick={next}>
            次
          </button>
        </div>
      </div>

      <div className={styles.grid}>
        {["月", "火", "水", "木", "金", "土", "日"].map((w) => (
          <div key={w} className={styles.weekday}>
            {w}
          </div>
        ))}
        {cells.map((c, i) => {
          const items = c.date ? byDay.get(c.date) ?? [] : [];
          return (
            <div
              key={i}
              className={`${styles.cell} ${items.length ? styles.has : ""}`}
            >
              {c.day ? <div className={styles.day}>{c.day}</div> : null}
              {items.slice(0, 2).map((l) => (
                <Link
                  key={l.id}
                  href={`/recipes/${l.recipeId}`}
                  className={styles.chip}
                  title={l.recipeName ?? ""}
                >
                  {l.recipeName}
                </Link>
              ))}
              {items.length > 2 ? (
                <div className={styles.more}>+{items.length - 2}</div>
              ) : null}
            </div>
          );
        })}
      </div>
    </AppShell>
  );
}
