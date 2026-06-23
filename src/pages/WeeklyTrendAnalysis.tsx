import { PowerBIPageShell } from "../components/PowerBIPageShell";
import { EmptyState } from "../components/EmptyState";
import { WeeklyStageTrendChart } from "../components/WeeklyStageTrendChart";
import { DashboardError, DashboardLoading, DashboardUpdateStatus } from "../components/ApiState";
import { useQualityFilters } from "../lib/filter-context";
import { dashboardQueryKey, getWeeklyTrend } from "../services/dashboardApi";
import { useApiQuery } from "../hooks/useApiQuery";
import { useMemo, useState } from "react";

export function WeeklyTrendAnalysis() {
  const { filters, filtersReady, filtersError, refetchFilters } = useQualityFilters();
  const [viewBy, setViewBy] = useState<"weekly" | "daily">("weekly");
  const queryKey = useMemo(
    () => dashboardQueryKey("/weekly-trend", filters, { granularity: viewBy }),
    [filters, viewBy],
  );
  const { data, isInitialLoading, isUpdating, error, retry } = useApiQuery({
    queryKey,
    queryFn: (signal) => getWeeklyTrend(filters, viewBy, signal),
    enabled: filtersReady,
    staleTime: 120_000,
    debounceMs: 300,
  });
  const rows = data?.weeklyTrend ?? [];

  return (
    <PowerBIPageShell
      pageId="weekly-page"
      pageExportFileName="O2_Weekly_Trend_Analysis"
      showWeekNumbers
      showBottomAccent={false}
    >
      {filtersError ? (
        <DashboardError onRetry={refetchFilters} message={filtersError} />
      ) : !filtersReady || isInitialLoading ? (
        <DashboardLoading />
      ) : error && !data ? (
        <DashboardError onRetry={retry} message={error} />
      ) : rows.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <DashboardUpdateStatus isUpdating={isUpdating} error={error} onRetry={retry} />
          <WeeklyStageTrendChart data={rows} highlights={[]} viewBy={viewBy} onViewByChange={setViewBy} />
        </>
      )}
    </PowerBIPageShell>
  );
}
