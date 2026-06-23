import { PowerBIPageShell } from "../components/PowerBIPageShell";
import { EmptyState } from "../components/EmptyState";
import { MonthlyRibbonTrendChart } from "../components/charts/MonthlyRibbonTrendChart";
import { DashboardError, DashboardLoading, DashboardUpdateStatus } from "../components/ApiState";
import { formatNumber, formatRate } from "../lib/format";
import { useQualityFilters } from "../lib/filter-context";
import { STAGE_META } from "../lib/stageConfig";
import { dashboardQueryKey, getOverview } from "../services/dashboardApi";
import { useApiQuery } from "../hooks/useApiQuery";
import type { KpiCardData } from "../types/api";
import type { InspectionStage } from "../lib/types";
import { useMemo } from "react";

type ExecutiveOverviewStage = Extract<InspectionStage, "Inline" | "Endline" | "Pre Final" | "Third Party">;

const overviewStages: ExecutiveOverviewStage[] = ["Inline", "Endline", "Pre Final", "Third Party"];

const labelRows: Record<InspectionStage, { defect: string; denominator: string }> = {
  Inline: {
    defect: "Process/Point Defects Pieces",
    denominator: "Total Process Checks",
  },
  Endline: {
    defect: "Endline Defect Qty",
    denominator: "Total Garments Inspected",
  },
  "Pre Final": {
    defect: "Pre Final Defects Qty",
    denominator: "Total Garments Inspected",
  },
  Final: {
    defect: "Final Defect Qty",
    denominator: "Total Garments Inspected",
  },
  "Third Party": {
    defect: "Third Party Defect Qty",
    denominator: "Total Inspect 3party",
  },
};

function OverviewKpiCard({
  stage,
  kpi,
}: {
  stage: ExecutiveOverviewStage;
  kpi: { rate: number; defectQty: number; denominator: number };
}) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-3.5 shadow-card">
      <div className="mb-3 h-1.5 rounded-full" style={{ backgroundColor: STAGE_META[stage].color }} />
      <div className="text-sm font-bold text-slate-700">{stage} Defect Rate</div>
      <div className="mt-1.5 font-display text-4xl font-semibold text-slate-950">{formatRate(kpi.rate)}</div>
      <div className="mt-3 grid gap-1.5 text-sm">
        <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-2">
          <span className="text-slate-500">{labelRows[stage].defect}</span>
          <span className="font-bold text-slate-900">{formatNumber(kpi.defectQty)}</span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-slate-500">{labelRows[stage].denominator}</span>
          <span className="font-bold text-slate-900">{formatNumber(kpi.denominator)}</span>
        </div>
      </div>
    </article>
  );
}

export function ExecutiveOverview() {
  const { filters, filtersReady, filtersError, refetchFilters } = useQualityFilters();
  const queryKey = useMemo(() => dashboardQueryKey("/overview", filters), [filters]);
  const { data, isInitialLoading, isUpdating, error, retry } = useApiQuery({
    queryKey,
    queryFn: (signal) => getOverview(filters, signal),
    enabled: filtersReady,
    staleTime: 120_000,
    debounceMs: 300,
  });
  const kpisByStage = new Map((data?.kpiCards ?? []).map((item) => [item.stage, item]));
  const hasData =
    Boolean(data?.monthlyTrend.length) ||
    Boolean(data?.kpiCards.some((item) => item.denominator > 0 || item.defects > 0));

  const getKpi = (stage: ExecutiveOverviewStage) => {
    const kpi: KpiCardData | undefined = kpisByStage.get(stage);
    return {
      rate: kpi?.rate ?? 0,
      defectQty: kpi?.defects ?? 0,
      denominator: kpi?.denominator ?? 0,
    };
  };

  return (
    <PowerBIPageShell
      pageId="overview-page"
      pageExportFileName="O2_Executive_Overview"
      showBottomAccent={false}
      contentClassName="pb-2"
    >
      {filtersError ? (
        <DashboardError onRetry={refetchFilters} message={filtersError} />
      ) : !filtersReady || isInitialLoading ? (
        <DashboardLoading />
      ) : error && !data ? (
        <DashboardError onRetry={retry} message={error} />
      ) : !data || !hasData ? (
        <EmptyState />
      ) : (
        <div className="space-y-3">
          <DashboardUpdateStatus isUpdating={isUpdating} error={error} onRetry={retry} />
          <section id="executive-kpi-section" className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {overviewStages.map((stage) => (
              <OverviewKpiCard key={stage} stage={stage} kpi={getKpi(stage)} />
            ))}
          </section>

          {data.monthlyTrend.length > 0 ? (
            <MonthlyRibbonTrendChart data={data.monthlyTrend} />
          ) : (
            <EmptyState />
          )}
        </div>
      )}
    </PowerBIPageShell>
  );
}
