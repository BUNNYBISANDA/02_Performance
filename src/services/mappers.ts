import type { InspectionStage, StatusLevel } from "../lib/types";
import type {
  DefectCategoryDetailRow,
  DefectCategoryResponse,
  DefectCategoryRow,
  KpiCardData,
  LineAnalysisResponse,
  LineDefectDetailRow,
  LineRateRow,
  MonthlyTrendItem,
  OverviewResponse,
  StageDetailResponse,
  WeeklyTrendItem,
  WeeklyTrendResponse,
} from "../types/api";

const STAGES: InspectionStage[] = ["Inline", "Endline", "Pre Final", "Final", "Third Party"];

type StageMetricKey = "inline" | "endline" | "preFinal" | "final" | "thirdParty";

const stageKeys: Record<InspectionStage, StageMetricKey> = {
  Inline: "inline",
  Endline: "endline",
  "Pre Final": "preFinal",
  Final: "final",
  "Third Party": "thirdParty",
};

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : {};

const asArray = <T = unknown>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);

const asNumber = (value: unknown) => {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
};

const asString = (value: unknown, fallback = "") => {
  if (value === null || value === undefined) return fallback;
  return String(value);
};

const asStatus = (value: unknown): StatusLevel => {
  if (value === "Good" || value === "Watch" || value === "Critical") return value;
  return "Good";
};

const normalizeStage = (value: unknown): InspectionStage => {
  const text = asString(value).trim();
  return STAGES.includes(text as InspectionStage) ? (text as InspectionStage) : "Inline";
};

const getStageValue = (row: Record<string, unknown>, stage: InspectionStage) => {
  const key = stageKeys[stage];
  return asNumber(row[key] ?? row[stage] ?? row[stage.toLowerCase()] ?? 0);
};

const emptyStageColumns = () =>
  STAGES.reduce<Partial<Record<InspectionStage, number>>>((acc, stage) => {
    acc[stage] = 0;
    return acc;
  }, {});

const mapKpiCard = (value: unknown): KpiCardData => {
  const row = asRecord(value);
  return {
    stage: normalizeStage(row.stage ?? row.inspection_stage),
    defects: asNumber(row.defects ?? row.defectQty ?? row.defect_qty),
    denominator: asNumber(row.denominator ?? row.inspectedQty ?? row.inspected_qty),
    rate: asNumber(row.rate ?? row.defectRate ?? row.defect_rate),
    target: asNumber(row.target),
    status: asStatus(row.status),
  };
};

export const mapMonthlyTrendToRibbonData = (items: unknown): MonthlyTrendItem[] =>
  asArray<Record<string, unknown>>(items).map((row) => ({
    month: asString(row.month),
    monthStart: asString(row.monthStart ?? row.month_start) || undefined,
    monthNumber: asNumber(row.monthNumber ?? row.month_number),
    inline: getStageValue(row, "Inline"),
    endline: getStageValue(row, "Endline"),
    preFinal: getStageValue(row, "Pre Final"),
    final: getStageValue(row, "Final"),
    thirdParty: getStageValue(row, "Third Party"),
  }));

export const mapWeeklyTrendToChartData = (items: unknown): WeeklyTrendItem[] =>
  asArray<Record<string, unknown>>(items).map((row, index) => {
    const isoWeekRaw = asString(row.isoWeek ?? row.iso_week ?? row.week);
    return {
      weekStart: asString(row.weekStart ?? row.week_start) || undefined,
      date: asString(row.date ?? row.inspectionDate ?? row.inspection_date) || undefined,
      label: asString(row.label) || undefined,
      isoWeek: isoWeekRaw.replace(/^\d{4}-/, "") || `W${String(index + 1).padStart(2, "0")}`,
      weekNumber: asNumber(row.weekNumber ?? row.week_number),
      month: asString(row.month),
      inline: getStageValue(row, "Inline"),
      endline: getStageValue(row, "Endline"),
      preFinal: getStageValue(row, "Pre Final"),
      final: getStageValue(row, "Final"),
      thirdParty: getStageValue(row, "Third Party"),
    };
  });

export const mapOverviewResponse = (response: OverviewResponse): OverviewResponse => ({
  ...response,
  kpiCards: asArray(response.kpiCards).map(mapKpiCard),
  monthlyTrend: mapMonthlyTrendToRibbonData(response.monthlyTrend),
  scanQty: {
    sewQty: asNumber(asRecord(response.scanQty).sewQty ?? asRecord(response.scanQty).sew_qty),
    enQty: asNumber(asRecord(response.scanQty).enQty ?? asRecord(response.scanQty).en_qty),
    fgQty: asNumber(asRecord(response.scanQty).fgQty ?? asRecord(response.scanQty).fg_qty),
  },
});

const mapDefectCategoryRow = (value: unknown): DefectCategoryRow => {
  const row = asRecord(value);
  const mapped = {
    ...emptyStageColumns(),
    name: asString(row.name ?? row.defectDescription ?? row.defect_description ?? row.defect_desc_eng, "Unmapped"),
    total: asNumber(row.total ?? row.defectQty ?? row.defect_qty),
  } as DefectCategoryRow;

  STAGES.forEach((stage) => {
    mapped[stage] = getStageValue(row, stage);
  });

  return mapped;
};

const mapDefectDetailRow = (value: unknown): DefectCategoryDetailRow => {
  const row = asRecord(value);
  return {
    defectDescription: asString(row.defectDescription ?? row.defect_description ?? row.defect_desc_eng, "Unmapped"),
    inspectionStage: normalizeStage(row.inspectionStage ?? row.inspection_stage),
    defects: asNumber(row.defects ?? row.defectQty ?? row.defect_qty),
    denominator: asNumber(row.denominator),
    rate: asNumber(row.rate ?? row.defectRate ?? row.defect_rate),
    share: asNumber(row.share),
  };
};

export const mapDefectCategoriesResponse = (response: DefectCategoryResponse): DefectCategoryResponse => ({
  ...response,
  topCategories: asArray(response.topCategories).map(mapDefectCategoryRow),
  detailTable: asArray(response.detailTable).map(mapDefectDetailRow),
  totals: {
    defectQty: asNumber(asRecord(response.totals).defectQty ?? asRecord(response.totals).defect_qty),
    byStage: (asRecord(response.totals).byStage ?? asRecord(response.totals).by_stage ?? {}) as Partial<
      Record<InspectionStage, number>
    >,
    denominatorByStage: (asRecord(response.totals).denominatorByStage ??
      asRecord(response.totals).denominator_by_stage ??
      {}) as Partial<Record<InspectionStage, number>>,
  },
});

const mapLineRateRow = (value: unknown): LineRateRow => {
  const row = asRecord(value);
  const mapped = {
    ...emptyStageColumns(),
    name: asString(row.name ?? row.fac_line ?? row.line, "Unassigned"),
    line: asString(row.line ?? row.fac_line ?? row.name, "Unassigned"),
    fac_line: asString(row.fac_line ?? row.line ?? row.name, "Unassigned"),
    totalDefects: asNumber(row.totalDefects ?? row.total_defects ?? row.defects),
    denominator: asNumber(row.denominator),
    rate: asNumber(row.rate),
    mainStage: normalizeStage(row.mainStage ?? row.main_stage),
    topDefect: row.topDefect === null ? null : asString(row.topDefect ?? row.top_defect, "") || null,
    status: asStatus(row.status),
  } as LineRateRow;

  STAGES.forEach((stage) => {
    mapped[stage] = getStageValue(row, stage);
  });

  return mapped;
};

const mapLineDefectDetailRow = (value: unknown): LineDefectDetailRow => {
  const row = asRecord(value);
  return {
    line: asString(row.line ?? row.fac_line, "Unassigned"),
    fac_line: asString(row.fac_line ?? row.line, "Unassigned"),
    defectDescription: asString(row.defectDescription ?? row.defect_description ?? row.defect_desc_eng, "Unmapped"),
    inspectionStage: normalizeStage(row.inspectionStage ?? row.inspection_stage),
    defects: asNumber(row.defects ?? row.defectQty ?? row.defect_qty),
    denominator: asNumber(row.denominator),
    rate: asNumber(row.rate ?? row.defectRate ?? row.defect_rate),
  };
};

export const mapLineAnalysisResponse = (response: LineAnalysisResponse): LineAnalysisResponse => ({
  ...response,
  lineLevelDefectRates: asArray(response.lineLevelDefectRates).map(mapLineRateRow),
  lineDefectDetailTable: asArray(response.lineDefectDetailTable).map(mapLineDefectDetailRow),
  totals: {
    lineCount: asNumber(asRecord(response.totals).lineCount ?? asRecord(response.totals).line_count),
    defectQty: asNumber(asRecord(response.totals).defectQty ?? asRecord(response.totals).defect_qty),
    denominator: asNumber(asRecord(response.totals).denominator),
  },
});

const mapStageDetailRow = (value: unknown) => {
  const row = asRecord(value);
  return {
    defectDescription: asString(row.defectDescription ?? row.defect_description ?? row.defect_desc_eng, "Unmapped"),
    defects: asNumber(row.defects ?? row.defectQty ?? row.defect_qty),
    denominator: asNumber(row.denominator),
    rate: asNumber(row.rate ?? row.defectRate ?? row.defect_rate),
    share: asNumber(row.share),
    status: asStatus(row.status),
  };
};

export const mapStageTrendToChartData = (items: WeeklyTrendItem[], stage: InspectionStage) => {
  const key = stageKeys[stage] ?? "inline";
  return items.map((item) => ({
    week: item.label ?? (item.date ? new Date(`${item.date}T00:00:00`).toLocaleDateString("en-US", {
      month: "short",
      day: "2-digit",
    }) : item.isoWeek),
    month: item.month,
    [stage]: asNumber(item[key]),
  }));
};

export const mapStageDetailResponse = (response: StageDetailResponse): StageDetailResponse => ({
  ...response,
  stage: normalizeStage(response.stage),
  selectedStageKpiSummary: {
    ...mapKpiCard(response.selectedStageKpiSummary),
    activeSoCount: asNumber(
      asRecord(response.selectedStageKpiSummary).activeSoCount ??
        asRecord(response.selectedStageKpiSummary).active_so_count,
    ),
    activeLineCount: asNumber(
      asRecord(response.selectedStageKpiSummary).activeLineCount ??
        asRecord(response.selectedStageKpiSummary).active_line_count,
    ),
  },
  donutValues: asArray<Record<string, unknown>>(response.donutValues).map((row) => ({
    name: asString(row.name),
    value: asNumber(row.value),
    color: asString(row.color, "#CBD5E1"),
  })),
  topDefects: asArray<Record<string, unknown>>(response.topDefects).map((row) => ({
    name: asString(row.name ?? row.defectDescription ?? row.defect_description ?? row.defect_desc_eng, "Unmapped"),
    defects: asNumber(row.defects ?? row.defectQty ?? row.defect_qty),
    rate: asNumber(row.rate ?? row.defectRate ?? row.defect_rate),
    share: asNumber(row.share),
    status: asStatus(row.status),
  })),
  trend: mapWeeklyTrendToChartData(response.trend),
  dailyTrend: response.dailyTrend ? mapWeeklyTrendToChartData(response.dailyTrend) : undefined,
  detailTable: asArray(response.detailTable).map(mapStageDetailRow),
});

export const mapWeeklyTrendResponse = (response: WeeklyTrendResponse): WeeklyTrendResponse => ({
  ...response,
  weeklyTrend: mapWeeklyTrendToChartData(response.weeklyTrend),
  dailyTrend: response.dailyTrend ? mapWeeklyTrendToChartData(response.dailyTrend) : undefined,
});
