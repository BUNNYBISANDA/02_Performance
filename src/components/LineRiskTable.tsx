import { clsx } from "clsx";
import { formatNumber, formatRate } from "../lib/format";
import { STAGE_META, statusClass } from "../lib/stageConfig";
import type { LineRiskRow } from "../lib/types";

export function LineRiskTable({ rows }: { rows: LineRiskRow[] }) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-card">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-command-steel">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">Line</th>
              <th className="px-4 py-3 text-right font-semibold">Rate</th>
              <th className="px-4 py-3 text-right font-semibold">Defects</th>
              <th className="px-4 py-3 text-right font-semibold">Inspected / Checks</th>
              <th className="px-4 py-3 text-left font-semibold">Primary risk</th>
              <th className="px-4 py-3 text-left font-semibold">Top defect</th>
              <th className="px-4 py-3 text-left font-semibold">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => (
              <tr key={row.line} className="transition hover:bg-cyan-50/45">
                <td className="px-4 py-3 font-semibold text-navy-900">{row.line}</td>
                <td className="px-4 py-3 text-right font-semibold text-navy-900">{formatRate(row.rate)}</td>
                <td className="px-4 py-3 text-right text-slate-700">{formatNumber(row.defects)}</td>
                <td className="px-4 py-3 text-right text-slate-700">{formatNumber(row.denominator)}</td>
                <td className="px-4 py-3">
                  <span
                    className="inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold"
                    style={{
                      backgroundColor: STAGE_META[row.mainStage].softColor,
                      color: STAGE_META[row.mainStage].color,
                    }}
                  >
                    {row.mainStage}
                  </span>
                </td>
                <td className="max-w-[260px] px-4 py-3 text-slate-700">{row.topDefect}</td>
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
