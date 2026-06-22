import { ClipboardList, Gauge, ScanLine, Tags } from "lucide-react";
import { useMemo, useState } from "react";
import { KPIStatCard } from "../components/KPIStatCard";
import { EmptyState } from "../components/EmptyState";
import { DashboardError, DashboardLoading, DashboardUpdateStatus } from "../components/ApiState";
import { StageStatusDonutChart } from "../components/StageStatusDonutChart";
import { TopDefectBarChart } from "../components/TopDefectBarChart";
import { TopFilterRow } from "../components/TopFilterRow";
import { TrendChart } from "../components/TrendChart";
import { GradientHeader } from "../components/GradientHeader";
import { formatNumber, formatRate } from "../lib/format";
import { useQualityFilters } from "../lib/filter-context";
import { buildDashboardExportFilters, buildExportFileBase } from "../lib/exportFilters";
import { STAGE_META } from "../lib/stageConfig";
import { dashboardQueryKey, getStageDetail, mapStageTrendToChartData } from "../services/dashboardApi";
import { useApiQuery } from "../hooks/useApiQuery";
import type { InspectionStage } from "../lib/types";
import { ExportMenu } from "../components/common/ExportMenu";
import { ExcelExportButton } from "../components/common/ExcelExportButton";
import type { ExcelColumn } from "../utils/exportExcel";

const stageTitleMap: Record<InspectionStage, { donut: string; bar: string; inspected: string }> = {
  Inline: {
    donut: "Inline Defect Qty and Total Inspect Inline",
    bar: "Inline Defect Qty by defect_desc_eng",
    inspected: "Total Inspect Inline",
  },
  Endline: {
    donut: "Endline Defect Qty and Total Inspect Endline",
    bar: "Endline Defect Qty by defect_desc_eng",
    inspected: "Total Inspect Endline",
  },
  "Pre Final": {
    donut: "Pre Final Defect Qty, Total Inspect Inline and Total Inspect Pre Final",
    bar: "Pre Final Defect Qty by defect_desc_eng",
    inspected: "Total Inspect Pre Final",
  },
  Final: {
    donut: "Final Defect Qty and Total Inspect Final",
    bar: "Final Defect Qty by defect_desc_eng",
    inspected: "Total Inspect Final",
  },
  "Third Party": {
    donut: "Third Party Defect Qty and Third Party Defect Rate",
    bar: "Third Party Defect Qty by defect_desc_eng",
    inspected: "Total Inspect 3party",
  },
};

function getStageDeepDiveTitle(customer: string | undefined, stage: InspectionStage) {
  if (!customer) return `${stage} Quality Deep Dive`;
  return `${customer} - ${stage} Quality Deep Dive`;
}

export function InspectionStageDeepDivePage() {
  const { filters, filtersReady, filtersError, refetchFilters } = useQualityFilters();
  const [stage, setStage] = useState<InspectionStage>("Inline");
  const queryKey = useMemo(
    () => dashboardQueryKey("/stage-detail", filters, { stage }),
    [filters, stage],
  );
  const { data, isInitialLoading, isUpdating, error, retry } = useApiQuery({
    queryKey,
    queryFn: (signal) => getStageDetail(filters, stage, signal),
    enabled: filtersReady,
    staleTime: 120_000,
    debounceMs: 300,
  });
  const kpi = data?.selectedStageKpiSummary;
  const defects = data?.topDefects ?? [];
  const donut = data?.donutValues ?? [];
  const trend = useMemo(() => mapStageTrendToChartData(data?.trend ?? [], stage), [data?.trend, stage]);
  const topDefect = defects[0];
  const hasData = Boolean(kpi && (kpi.denominator > 0 || kpi.defects > 0 || defects.length > 0));
  const excelColumns: ExcelColumn[] = [
    { key: "defectDescription", header: "defect_desc_eng", width: 38, type: "text" },
    { key: "defects", header: `${stage} Defect Qty`, width: 16, type: "number" },
    { key: "denominator", header: stageTitleMap[stage].inspected, width: 20, type: "number" },
    { key: "rate", header: `${stage} Defect Rate`, width: 14, type: "percent" },
    { key: "share", header: "Share %", width: 12, type: "percent" },
  ];
  const excelRows = (data?.detailTable ?? []).map((row) => ({
    defectDescription: row.defectDescription,
    defects: row.defects,
    denominator: kpi?.denominator ?? 0,
    rate: row.rate,
    share: row.share,
  }));
  const excelTotalsRow = kpi
    ? { defectDescription: "Total", defects: kpi.defects, denominator: kpi.denominator, rate: kpi.rate, share: 100 }
    : undefined;

  return (
    <div id="stage-deep-dive-page" data-export-page="true" className="min-h-screen bg-[#f4f6fb]">
      <GradientHeader
        title={getStageDeepDiveTitle(filters.customer, stage)}
        eyebrow="Inspection Stage Deep Dive"
        pageExport={{ targetId: "stage-deep-dive-page", fileName: "O2_Inspection_Stage_Deep_Dive" }}
      />
      <main className="mx-auto max-w-[1600px] space-y-4 px-4 py-4 sm:px-6">
        <TopFilterRow stage={stage} onStageChange={setStage} />

        {filtersError ? (
          <DashboardError onRetry={refetchFilters} message={filtersError} />
        ) : !filtersReady || isInitialLoading ? (
          <DashboardLoading />
        ) : error && !data ? (
          <DashboardError onRetry={retry} message={error} />
        ) : !data || !kpi || !hasData ? (
          <EmptyState />
        ) : (
          <>
        <DashboardUpdateStatus isUpdating={isUpdating} error={error} onRetry={retry} />
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <KPIStatCard
            title={`${stage} Defect Rate`}
            value={formatRate(kpi.rate)}
            subLabel={`Target ${formatRate(kpi.target)}`}
            status={kpi.status}
            accent={STAGE_META[stage].color}
            icon={<Gauge className="h-5 w-5" />}
          />
          <KPIStatCard
            title={`${stage} Defect Qty`}
            value={formatNumber(kpi.defects)}
            subLabel={topDefect?.name ?? "No defects"}
            accent={STAGE_META[stage].color}
            icon={<Tags className="h-5 w-5" />}
          />
          <KPIStatCard
            title={stageTitleMap[stage].inspected}
            value={formatNumber(kpi.denominator)}
            subLabel={STAGE_META[stage].denominatorLabel}
            accent="#123C69"
            icon={<ClipboardList className="h-5 w-5" />}
          />
          <KPIStatCard
            title="Active SO / Lines"
            value={formatNumber(kpi.activeSoCount)}
            subLabel={`${formatNumber(kpi.activeLineCount)} active lines`}
            accent="#00AEEF"
            icon={<ScanLine className="h-5 w-5" />}
          />
        </section>

        <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
          <StageStatusDonutChart title={stageTitleMap[stage].donut} data={donut} />
          <div id="stage-top-defect-chart">
            <div className="mb-3 flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-card">
              <h2 className="font-display text-lg font-semibold text-slate-900">{stageTitleMap[stage].bar}</h2>
              <ExportMenu
                targetId="stage-top-defect-chart"
                fileName={`O2_${stage.replace(/\s+/g, "_")}_Top_Defects`}
              />
            </div>
            <TopDefectBarChart data={defects.slice(0, 8)} color={STAGE_META[stage].color} height={310} />
          </div>
        </section>

        <section id="stage-trend-chart">
          <div className="mb-3 flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-card">
            <h2 className="font-display text-lg font-semibold text-slate-900">{stage} Defect Rate Trend</h2>
            <ExportMenu
              targetId="stage-trend-chart"
              fileName={`O2_${stage.replace(/\s+/g, "_")}_Defect_Rate_Trend`}
            />
          </div>
          <TrendChart
            data={trend}
            height={300}
            series={[
              {
                key: stage,
                name: `${stage} Defect Rate`,
                color: STAGE_META[stage].color,
                target: STAGE_META[stage].target,
              },
            ]}
          />
        </section>

        <section id="stage-detail-table" className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-card">
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
            <h2 className="font-display text-lg font-semibold text-slate-900">{stage} Detail Summary</h2>
            <ExcelExportButton
              fileName={buildExportFileBase(`O2_${stage.replace(/\s+/g, "_")}_Detail_Summary`, filters)}
              sheetName={`${stage} Detail Summary`}
              title={`${stage} Detail Summary`}
              filters={buildDashboardExportFilters(filters, { "Selected Stage": stage })}
              columns={excelColumns}
              rows={excelRows}
              totalsRow={excelTotalsRow}
            />
          </div>
          <div data-export-expandable="true" className="max-h-[320px] overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 z-10 bg-slate-100 text-xs uppercase text-slate-600">
                <tr>
                  <th className="px-4 py-3 text-left font-bold">defect_desc_eng</th>
                  <th className="px-4 py-3 text-right font-bold">{stage} Defect Qty</th>
                  <th className="px-4 py-3 text-right font-bold">{stageTitleMap[stage].inspected}</th>
                  <th className="px-4 py-3 text-right font-bold">{stage} Defect Rate</th>
                  <th className="px-4 py-3 text-right font-bold">Share</th>
                </tr>
              </thead>
              <tbody>
                {data.detailTable.map((row, index) => (
                  <tr key={row.defectDescription} className={index % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                    <td className="max-w-[440px] px-4 py-2.5 font-semibold text-slate-900">{row.defectDescription}</td>
                    <td className="px-4 py-2.5 text-right text-slate-700">{formatNumber(row.defects)}</td>
                    <td className="px-4 py-2.5 text-right text-slate-700">{formatNumber(kpi.denominator)}</td>
                    <td className="px-4 py-2.5 text-right text-slate-700">{formatRate(row.rate)}</td>
                    <td className="px-4 py-2.5 text-right text-slate-700">{formatRate(row.share)}</td>
                  </tr>
                ))}
                <tr className="sticky bottom-0 bg-[#eef4ff] font-bold text-slate-950">
                  <td className="px-4 py-3">Total</td>
                  <td className="px-4 py-3 text-right">{formatNumber(kpi.defects)}</td>
                  <td className="px-4 py-3 text-right">{formatNumber(kpi.denominator)}</td>
                  <td className="px-4 py-3 text-right">{formatRate(kpi.rate)}</td>
                  <td className="px-4 py-3 text-right">100.00%</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
          </>
        )}
      </main>
      <div className="h-1 bg-[linear-gradient(90deg,#7c2bd9,#3154d4,#00a9b7)]" />
    </div>
  );
}
