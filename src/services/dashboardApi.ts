import type { FilterState, InspectionStage } from "../lib/types";
import type {
  DashboardFilters,
  DefectCategoryResponse,
  FilterOptionsResponse,
  HealthResponse,
  LineAnalysisResponse,
  OverviewResponse,
  StageDetailResponse,
  WeeklyTrendResponse,
} from "../types/api";
import { getJson } from "./apiClient";
import {
  mapDefectCategoriesResponse,
  mapLineAnalysisResponse,
  mapOverviewResponse,
  mapStageDetailResponse,
  mapStageTrendToChartData,
  mapWeeklyTrendResponse,
} from "./mappers";

const ALL_VALUE = "All";

const cleanDate = (value?: string | null) => {
  if (!value) return undefined;
  return value.slice(0, 10);
};

const logRowCount = (label: string, response: { meta?: { rowCount?: number } }) => {
  if (import.meta.env.DEV && response.meta?.rowCount !== undefined) {
    console.log(`[${label}] rowCount:`, response.meta.rowCount);
  }
};

export const toDashboardFilters = (filters: FilterState): DashboardFilters => ({
  customer: filters.customer || undefined,
  factory: filters.factory && filters.factory !== ALL_VALUE ? filters.factory : undefined,
  startDate: filters.dateFrom || undefined,
  endDate: filters.dateTo || undefined,
  soNumbers: filters.soNumbers,
  styles: filters.styles,
  lines: filters.lines,
  defectDescriptions: filters.defectDescriptions,
  inspectionStages: filters.inspectionCategories,
});

export { mapStageTrendToChartData };

export const getHealth = () => getJson<HealthResponse>("/health");

export const getFilters = async (filters: DashboardFilters = {}, signal?: AbortSignal) => {
  const response = await getJson<FilterOptionsResponse>("/filters", filters, { signal });
  const mapped = {
    ...response,
    dateRange: response.dateRange
      ? {
          startDate: cleanDate(response.dateRange.startDate),
          endDate: cleanDate(response.dateRange.endDate),
        }
      : undefined,
    latestRefreshDate: cleanDate(response.latestRefreshDate),
  };

  logRowCount("Filters", mapped);
  return mapped;
};

export const getOverview = async (filters: FilterState, signal?: AbortSignal): Promise<OverviewResponse> => {
  const response = await getJson<OverviewResponse>("/overview", toDashboardFilters(filters), { signal });
  const mapped = mapOverviewResponse(response);
  logRowCount("Overview", mapped);
  return mapped;
};

export const getWeeklyTrend = async (filters: FilterState, signal?: AbortSignal) => {
  const response = await getJson<WeeklyTrendResponse>(
    "/weekly-trend",
    toDashboardFilters(filters),
    { signal },
  );
  const mapped = mapWeeklyTrendResponse(response);
  logRowCount("Weekly Trend", mapped);
  return mapped;
};

export const getDefectCategories = async (filters: FilterState, signal?: AbortSignal) => {
  const response = await getJson<DefectCategoryResponse>("/defect-categories", toDashboardFilters(filters), { signal });
  const mapped = mapDefectCategoriesResponse(response);
  logRowCount("Defect Categories", mapped);
  return mapped;
};

export const getLineAnalysis = async (filters: FilterState, signal?: AbortSignal) => {
  const response = await getJson<LineAnalysisResponse>("/line-analysis", toDashboardFilters(filters), { signal });
  const mapped = mapLineAnalysisResponse(response);
  logRowCount("Line Analysis", mapped);
  return mapped;
};

export const getStageDetail = async (filters: FilterState, stage: InspectionStage, signal?: AbortSignal) => {
  const response = await getJson<StageDetailResponse>("/stage-detail", {
    ...toDashboardFilters(filters),
    stage,
  }, { signal });
  const mapped = mapStageDetailResponse(response);
  logRowCount("Stage Detail", mapped);
  return mapped;
};

export const dashboardQueryKey = (
  endpoint: string,
  filters: FilterState,
  extra?: Record<string, string>,
) => JSON.stringify([endpoint, toDashboardFilters(filters), extra ?? null]);
