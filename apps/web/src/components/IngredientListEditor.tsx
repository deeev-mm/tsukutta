"use client";

import type { IngredientLine } from "@tsukutta/shared";
import { IconChevronDown, IconChevronUp, IconClose } from "./icons";

const inputStyle: React.CSSProperties = {
  border: "1px solid var(--line)",
  borderRadius: 10,
  padding: "10px 12px",
  background: "rgba(255,255,255,0.85)",
};

export function IngredientListEditor({
  value,
  onChange,
}: {
  value: IngredientLine[];
  onChange: (next: IngredientLine[]) => void;
}) {
  function update(i: number, patch: Partial<IngredientLine>) {
    onChange(value.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  }
  function remove(i: number) {
    onChange(value.filter((_, idx) => idx !== i));
  }
  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= value.length) return;
    const next = value.slice();
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  }

  return (
    <div className="stack" style={{ gap: 8 }}>
      {value.length === 0 ? <p className="hint">材料がありません</p> : null}
      {value.map((row, i) => (
        <div key={i} className="row" style={{ gap: 6, alignItems: "center", flexWrap: "nowrap" }}>
          {row.isSection ? (
            <input
              value={row.name}
              onChange={(e) => update(i, { name: e.target.value })}
              placeholder="見出し（例: 合わせ調味料）"
              style={{ flex: 1, fontWeight: 700, ...inputStyle }}
            />
          ) : (
            <>
              <input
                value={row.name}
                onChange={(e) => update(i, { name: e.target.value })}
                placeholder="材料名"
                style={{ flex: 2, minWidth: 0, ...inputStyle }}
              />
              <input
                value={row.amount}
                onChange={(e) => update(i, { amount: e.target.value })}
                placeholder="分量"
                style={{ flex: 1, minWidth: 0, ...inputStyle }}
              />
            </>
          )}
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => move(i, -1)}
            disabled={i === 0}
            aria-label="上へ移動"
            style={{ padding: "10px 12px" }}
          >
            <IconChevronUp />
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => move(i, 1)}
            disabled={i === value.length - 1}
            aria-label="下へ移動"
            style={{ padding: "10px 12px" }}
          >
            <IconChevronDown />
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => remove(i)}
            aria-label="削除"
            style={{ padding: "10px 12px" }}
          >
            <IconClose />
          </button>
        </div>
      ))}
      <div className="row">
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => onChange([...value, { name: "", amount: "" }])}
        >
          + 材料を追加
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => onChange([...value, { name: "", amount: "", isSection: true }])}
        >
          + 見出しを追加
        </button>
      </div>
    </div>
  );
}
