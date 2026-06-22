import { clsx } from "clsx";
import { formatNumber, formatRate } from "../lib/format";
import { statusClass } from "../lib/stageConfig";
import type { DefectSummaryRow } from "../lib/types";

export function DefectSummaryTable({ rows }: { rows: DefectSummaryRow[] }) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-card">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-command-steel">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">Defect description</th>
              <th className="px-4 py-3 text-right font-semibold">Defect qty</th>
              <th className="px-4 py-3 text-right font-semibold">Rate</th>
              <th className="px-4 py-3 text-right font-semibold">Share</th>
              <th className="px-4 py-3 text-left font-semibold">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => (
              <tr key={row.name} className="transition hover:bg-cyan-50/45">
                <td className="max-w-[320px] px-4 py-3 font-medium text-navy-900">{row.name}</td>
                <td className="px-4 py-3 text-right text-slate-700">{formatNumber(row.defects)}</td>
                <td className="px-4 py-3 text-right text-slate-700">{formatRate(row.rate)}</td>
                <td className="px-4 py-3 text-right text-slate-700">{formatRate(row.share)}</td>
                <td className="px-4 py-3">
                  <span className={clsx("rounded-full px-2 py-1 text-xs font-semibold ring-1", statusClass(row.status))}>
                    {row.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
