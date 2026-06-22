import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { clsx } from "clsx";
import type { ReactNode } from "react";
import { statusClass } from "../lib/stageConfig";
import type { StatusLevel } from "../lib/types";

export function KPIStatCard({
  title,
  value,
  subLabel,
  status,
  accent = "#11b7d9",
  delta,
  icon,
}: {
  title: string;
  value: string;
  subLabel: string;
  status?: StatusLevel;
  accent?: string;
  delta?: number;
  icon?: ReactNode;
}) {
  const DeltaIcon = delta === undefined || delta === 0 ? Minus : delta > 0 ? ArrowUpRight : ArrowDownRight;

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase text-command-steel">{title}</div>
          <div className="mt-2 font-display text-3xl font-semibold text-navy-900">{value}</div>
        </div>
        <div
          className="flex h-10 w-10 items-center justify-center rounded-lg"
          style={{ backgroundColor: `${accent}18`, color: accent }}
        >
          {icon}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="text-command-steel">{subLabel}</span>
        <div className="flex items-center gap-2">
          {delta !== undefined && (
            <span
              className={clsx(
                "inline-flex items-center gap-1 text-xs font-semibold",
                delta > 0 ? "text-rose-600" : delta < 0 ? "text-emerald-600" : "text-slate-500",
              )}
            >
              <DeltaIcon className="h-3.5 w-3.5" />
              {Math.abs(delta).toFixed(1)} pp
            </span>
          )}
          {status && (
            <span className={clsx("rounded-full px-2 py-1 text-xs font-semibold ring-1", statusClass(status))}>
              {status}
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
