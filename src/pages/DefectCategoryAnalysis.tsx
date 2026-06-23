import { GroupedDefectBarChart } from "../components/GroupedDefectBarChart";
import { EmptyState } from "../components/EmptyState";
import { PowerBIPageShell } from "../components/PowerBIPageShell";
import { DashboardError, DashboardLoading, DashboardUpdateStatus } from "../components/ApiState";
import { formatNumber } from "../lib/format";
import { useQualityFilters } from "../lib/filter-context";
import { buildDashboardExportFilters, buildExportFileBase } from "../lib/exportFilters";
import { INSPECTION_STAGES, STAGE_META } from "../lib/stageConfig";
import { dashboardQueryKey, getDefectCategories } from "../services/dashboardApi";
import { useApiQuery } from "../hooks/useApiQuery";
import { useMemo } from "react";
import { ExcelExportButton } from "../components/common/ExcelExportButton";
import type { ExcelColumn } from "../utils/exportExcel";

export function DefectCategoryAnalysis() {
  const { filters, filtersReady, filtersError, refetchFilters } = useQualityFilters();
  const queryKey = useMemo(() => dashboardQueryKey("/defect-categories", filters), [filters]);
  const { data, isInitialLoading, isUpdating, error, retry } = useApiQuery({
    queryKey,
    queryFn: (signal) => getDefectCategories(filters, signal),
    enabled: filtersReady,
    staleTime: 120_000,
    debounceMs: 300,
  });
  const chartRows = data?.topCategories.slice(0, 14) ?? [];
  const totalRow = INSPECTION_STAGES.reduce<Record<string, number>>((acc, stage) => {
    acc[stage] = Number(data?.totals.byStage[stage] ?? 0);
    return acc;
  }, {});
  const grandTotalQty = INSPECTION_STAGES.reduce((sum, stage) => sum + (totalRow[stage] ?? 0), 0);
  const excelColumns: ExcelColumn[] = [
    { key: "name", header: "Defect Category", width: 38, type: "text" },
    ...INSPECTION_STAGES.map((stage) => ({
      key: stage,
      header: `${stage} Defect Qty`,
      width: 16,
      type: "number" as const,
    })),
    { key: "total", header: "Total Qty", width: 14, type: "number" },
    { key: "share", header: "Share %", width: 12, type: "percent" },
  ];
  const excelRows = chartRows.map((row) => ({
    name: row.name,
    ...INSPECTION_STAGES.reduce<Record<string, number>>((result, stage) => {
      result[stage] = Number(row[stage] ?? 0);
      return result;
    }, {}),
    total: Number(row.total ?? 0),
    share: grandTotalQty ? (Number(row.total ?? 0) / grandTotalQty) * 100 : 0,
  }));
  const excelTotalsRow = { name: "Total", ...totalRow, total: grandTotalQty, share: 100 };

  return (
    <PowerBIPageShell
      pageId="defect-category-page"
      pageExportFileName="O2_Defect_Category_Analysis"
    >
      <div className="space-y-4">
        {filtersError ? (
          <DashboardError onRetry={refetchFilters} message={filtersError} />
        ) : !filtersReady || isInitialLoading ? (
          <DashboardLoading />
        ) : error && !data ? (
          <DashboardError onRetry={retry} message={error} />
        ) : chartRows.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            <DashboardUpdateStatus isUpdating={isUpdating} error={error} onRetry={retry} />
            <GroupedDefectBarChart data={chartRows} />

            <section id="defect-category-detail-table" className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-card transition-[transform,box-shadow,border-color] duration-200 ease-out hover:-translate-y-0.5 hover:border-cyan-200 hover:shadow-lift">
              <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
                <h2 className="font-display text-lg font-semibold text-slate-900">Defect Category Detail Summary</h2>
                <ExcelExportButton
                  fileName={buildExportFileBase("O2_Defect_Category_Detail", filters)}
                  sheetName="Defect Category Detail"
                  title="Defect Category Detail Summary"
                  filters={buildDashboardExportFilters(filters)}
                  columns={excelColumns}
                  rows={excelRows}
                  totalsRow={excelTotalsRow}
                />
              </div>
              <div data-export-expandable="true" className="max-h-[310px] overflow-auto">
                <table className="min-w-full text-sm">
                  <thead className="sticky top-0 z-10 bg-slate-100 text-xs uppercase text-slate-600">
                    <tr>
                      <th className="px-4 py-3 text-left font-bold">defect_desc_eng</th>
                      {INSPECTION_STAGES.map((stage) => (
                        <th key={stage} className="px-4 py-3 text-right font-bold" style={{ color: STAGE_META[stage].color }}>
                          {stage} Defect Qty
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {chartRows.map((row, index) => (
                      <tr key={String(row.name)} className={index % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                        <td className="max-w-[360px] px-4 py-2.5 font-semibold text-slate-900">{row.name}</td>
                        {INSPECTION_STAGES.map((stage) => (
                          <td key={stage} className="px-4 py-2.5 text-right text-slate-700">
                            {formatNumber(Number(row[stage] ?? 0))}
                          </td>
                        ))}
                      </tr>
                    ))}
                    <tr className="sticky bottom-0 bg-[#eef4ff] font-bold text-slate-950">
                      <td className="px-4 py-3">Total</td>
                      {INSPECTION_STAGES.map((stage) => (
                        <td key={stage} className="px-4 py-3 text-right">
                          {formatNumber(totalRow[stage] ?? 0)}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </div>
    </PowerBIPageShell>
  );
}
