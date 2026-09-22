"use client";

import type { ReactNode } from "react";

interface StatCardProps {
  label: string;
  value: string | number;
  subtitle?: string;
  accent?: boolean;
  gold?: boolean;
  icon?: ReactNode;
}

export function StatCard({ label, value, subtitle, accent, gold, icon }: StatCardProps) {
  const valueColor = gold
    ? "text-gold-bright"
    : accent
    ? "text-accent-bright"
    : "text-text-primary";

  const ringColor = gold
    ? "before:bg-gold/40"
    : accent
    ? "before:bg-accent/40"
    : "before:bg-surface-4/40";

  return (
    <div
      className={`card-hover glass relative overflow-hidden rounded-2xl p-5 before:absolute before:inset-x-0 before:top-0 before:h-px ${ringColor}`}
    >
      <div className="flex items-start justify-between">
        <p className="text-xs font-medium uppercase tracking-wider text-text-muted">
          {label}
        </p>
        {icon && <span className="text-text-muted">{icon}</span>}
      </div>
      <p className={`mt-3 font-display text-3xl font-bold tabular-nums ${valueColor}`}>
        {value}
      </p>
      {subtitle && <p className="mt-1 text-xs text-text-muted">{subtitle}</p>}
    </div>
  );
}
