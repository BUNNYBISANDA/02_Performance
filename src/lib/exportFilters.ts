import { ALL_VALUE } from "./filter-context";
import type { FilterState } from "./types";

export type ExportFilterSummary = Record<string, string | string[] | number | undefined>;

const skipAll = (value: string) => (value && value !== ALL_VALUE ? value : undefined);

const dateRangeLabel = (filters: FilterState) =>
  filters.dateFrom && filters.dateTo ? `${filters.dateFrom} to ${filters.dateTo}` : undefined;

export const buildDashboardExportFilters = (
  filters: FilterState,
  extra?: ExportFilterSummary,
): ExportFilterSummary => ({
  Customer: skipAll(filters.customer),
  Factory: skipAll(filters.factory),
  "Date Range": dateRangeLabel(filters),
  "SO Number": filters.soNumbers,
  Style: filters.styles,
  Line: filters.lines,
  "Defect Description": filters.defectDescriptions,
  "Inspection Stage": filters.inspectionCategories,
  ...extra,
});

export const buildExportFileBase = (baseName: string, filters: FilterState) =>
  [baseName, skipAll(filters.customer), skipAll(filters.factory)].filter(Boolean).join("_");
