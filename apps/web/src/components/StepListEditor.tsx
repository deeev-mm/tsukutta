"use client";

const inputStyle: React.CSSProperties = {
  border: "1px solid var(--line)",
  borderRadius: 10,
  padding: "10px 12px",
  background: "rgba(255,255,255,0.85)",
  width: "100%",
};

export function StepListEditor({
  value,
  onChange,
}: {
  value: string[];
  onChange: (next: string[]) => void;
}) {
  function update(i: number, v: string) {
    onChange(value.map((s, idx) => (idx === i ? v : s)));
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
      {value.length === 0 ? <p className="hint">手順がありません</p> : null}
      {value.map((step, i) => (
        <div key={i} className="row" style={{ gap: 6, alignItems: "flex-start", flexWrap: "nowrap" }}>
          <span className="muted" style={{ paddingTop: 10, minWidth: 22 }}>
            {i + 1}.
          </span>
          <textarea
            value={step}
            onChange={(e) => update(i, e.target.value)}
            style={{ flex: 1, minHeight: 44, ...inputStyle }}
          />
          <div className="stack" style={{ gap: 4 }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => move(i, -1)}
              disabled={i === 0}
              aria-label="上へ移動"
              style={{ padding: "6px 12px" }}
            >
              ↑
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => move(i, 1)}
              disabled={i === value.length - 1}
              aria-label="下へ移動"
              style={{ padding: "6px 12px" }}
            >
              ↓
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => remove(i)}
              aria-label="削除"
              style={{ padding: "6px 12px" }}
            >
              ×
            </button>
          </div>
        </div>
      ))}
      <button type="button" className="btn btn-secondary" onClick={() => onChange([...value, ""])}>
        + 手順を追加
      </button>
    </div>
  );
}
