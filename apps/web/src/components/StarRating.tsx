"use client";

import { IconStar } from "./icons";

export function StarRating({
  value,
  max = 5,
  size = 16,
  className,
}: {
  value: number;
  max?: number;
  size?: number;
  className?: string;
}) {
  const filledCount = Math.round(value);
  return (
    <span
      className={`stars stars-filled ${className ?? ""}`}
      aria-label={`評価 ${value.toFixed(1)}`}
      style={{ display: "inline-flex" }}
    >
      {Array.from({ length: max }, (_, i) => (
        <IconStar key={i} filled={i < filledCount} size={size} />
      ))}
    </span>
  );
}
