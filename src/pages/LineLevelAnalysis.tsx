import { Fragment } from "react";
import { LineStageRateChart } from "../components/LineStageRateChart";
import { EmptyState } from "../components/EmptyState";
import { PowerBIPageShell } from "../components/PowerBIPageShell";
import { DashboardError, DashboardLoading, DashboardUpdateStatus } from "../components/ApiState";
import { formatRate } from "../lib/format";
import { useQualityFilters } from "../lib/filter-context";
import { buildDashboardExportFilters, buildExportFileBase } from "../lib/exportFilters";
import { INSPECTION_STAGES, STAGE_META } from "../lib/stageConfig";
import { dashboardQueryKey, getLineAnalysis } from "../services/dashboardApi";
import { useApiQuery } from "../hooks/useApiQuery";
import type { LineDefectDetailRow } from "../types/api";
import type { InspectionStage } from "../lib/types";
import { useMemo } from "react";
import { ExcelExportButton } from "../components/common/ExcelExportButton";
import type { ExcelColumn } from "../utils/exportExcel";

type PivotedLineDefect = {
  defect: string;
  totalDefects: number;
} & Partial<Record<InspectionStage, number>>;

const buildLineDefectRows = (
  rows: LineDefectDetailRow[],
) => {
  const byLine = new Map<string, Map<string, PivotedLineDefect>>();

  rows.forEach((row) => {
    const lineRows = byLine.get(row.line) ?? new Map<string, PivotedLineDefect>();
    const defectRow = lineRows.get(row.defectDescription) ?? {
      defect: row.defectDescription,
      totalDefects: 0,
    };

    defectRow[row.inspectionStage] = row.rate;
    defectRow.totalDefects += row.defects;
    lineRows.set(row.defectDescription, defectRow);
    byLine.set(row.line, lineRows);
  });

  return byLine;
};

const totalRatesByStage = (
  rows: LineDefectDetailRow[],
) => {
  const denominatorByLineStage = new Map<string, number>();
  const defectsByStage = new Map<InspectionStage, number>();

  rows.forEach((row) => {
    const denominatorKey = `${row.line}|${row.inspectionStage}`;
    denominatorByLineStage.set(
      denominatorKey,
      Math.max(denominatorByLineStage.get(denominatorKey) ?? 0, row.denominator),
    );
    defectsByStage.set(row.inspectionStage, (defectsByStage.get(row.inspectionStage) ?? 0) + row.defects);
  });

  return INSPECTION_STAGES.reduce<Record<string, number>>((acc, stage) => {
    const denominator = [...denominatorByLineStage.entries()]
      .filter(([key]) => key.endsWith(`|${stage}`))
      .reduce((sum, [, value]) => sum + value, 0);
    const defects = defectsByStage.get(stage) ?? 0;
    acc[stage] = denominator === 0 ? 0 : (defects / denominator) * 100;
    return acc;
  }, {});
};

export function LineLevelAnalysis() {
  const { filters, filtersReady, filtersError, refetchFilters } = useQualityFilters();
  const queryKey = useMemo(() => dashboardQueryKey("/line-analysis", filters), [filters]);
  const { data, isInitialLoading, isUpdating, error, retry } = useApiQuery({
    queryKey,
    queryFn: (signal) => getLineAnalysis(filters, signal),
    enabled: filtersReady,
    staleTime: 120_000,
    debounceMs: 300,
  });
  const chartRows = data?.lineLevelDefectRates ?? [];
  const lineDefects = buildLineDefectRows(data?.lineDefectDetailTable ?? []);
  const totalRates = totalRatesByStage(data?.lineDefectDetailTable ?? []);
  const excelColumns: ExcelColumn[] = [
    { key: "line", header: "fac-line", width: 16, type: "text" },
    { key: "topDefect", header: "Main Defect", width: 32, type: "text" },
    ...INSPECTION_STAGES.map((stage) => ({
      key: stage,
      header: `${stage} Defect Rate`,
      width: 16,
      type: "percent" as const,
    })),
    { key: "status", header: "Overall Risk Level", width: 16, type: "text" },
  ];
  const excelRows = chartRows.map((row) => ({
    line: row.line,
    topDefect: row.topDefect ?? "",
    ...INSPECTION_STAGES.reduce<Record<string, number>>((result, stage) => {
      result[stage] = Number(row[stage] ?? 0);
      return result;
    }, {}),
    status: row.status,
  }));
  const excelTotalsRow = { line: "Total", topDefect: "", ...totalRates, status: "" };

  return (
    <PowerBIPageShell
      pageId="line-analysis-page"
      pageExportFileName="O2_Line_Level_Analysis"
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
            <LineStageRateChart
              data={chartRows}
              selectedInspectionCategories={filters.inspectionCategories}
            />

            <section id="line-level-detail-table" className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-card">
              <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
                <h2 className="font-display text-lg font-semibold text-slate-900">
                  Line-Level Defect Detail Based on Selection
                </h2>
                <ExcelExportButton
                  fileName={buildExportFileBase("O2_Line_Level_Defect_Detail", filters)}
                  sheetName="Line-Level Defect Detail"
                  title="Line-Level Defect Detail Based on Selection"
                  filters={buildDashboardExportFilters(filters)}
                  columns={excelColumns}
                  rows={excelRows}
                  totalsRow={excelTotalsRow}
                />
              </div>
              <div data-export-expandable="true" className="max-h-[330px] overflow-auto">
                <table className="min-w-full text-sm">
                  <thead className="sticky top-0 z-10 bg-slate-100 text-xs uppercase text-slate-600">
                    <tr>
                      <th className="px-4 py-3 text-left font-bold">fac-line</th>
                      {INSPECTION_STAGES.map((stage) => (
                        <th key={stage} className="px-4 py-3 text-right font-bold" style={{ color: STAGE_META[stage].color }}>
                          {stage} Defect Rate
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {chartRows.map((lineRow) => {
                      const line = lineRow.line;
                      const defects = [...(lineDefects.get(line)?.values() ?? [])]
                        .sort((a, b) => b.totalDefects - a.totalDefects)
                        .slice(0, 4);

                      return (
                        <Fragment key={line}>
                          <tr className="bg-[#eef4ff] font-bold text-slate-950">
                            <td className="px-4 py-2.5">{line}</td>
                            {INSPECTION_STAGES.map((stage) => (
                              <td key={stage} className="px-4 py-2.5 text-right">
                                {formatRate(Number(lineRow[stage] ?? 0))}
                              </td>
                            ))}
                          </tr>
                          {defects.map((item, index) => (
                            <tr key={`${line}-${item.defect}`} className={index % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                              <td className="max-w-[360px] px-4 py-2.5 pl-8 text-slate-700">{item.defect}</td>
                              {INSPECTION_STAGES.map((stage) => (
                                <td key={stage} className="px-4 py-2.5 text-right text-slate-700">
                                  {formatRate(Number(item[stage] ?? 0))}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </Fragment>
                      );
                    })}
                    <tr className="sticky bottom-0 bg-[#e7f8fb] font-bold text-slate-950">
                      <td className="px-4 py-3">Total</td>
                      {INSPECTION_STAGES.map((stage) => (
                        <td key={stage} className="px-4 py-3 text-right">
                          {formatRate(totalRates[stage] ?? 0)}
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
