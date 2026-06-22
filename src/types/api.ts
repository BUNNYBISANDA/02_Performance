import type { InspectionStage, StatusLevel } from "../lib/types";

export type DashboardFilters = {
  customer?: string;
  factory?: string;
  startDate?: string;
  endDate?: string;
  soNumbers?: string[];
  styles?: string[];
  lines?: string[];
  defectDescriptions?: string[];
  inspectionStages?: string[];
};

export type ApiMeta = {
  rowCount: number;
  appliedFilters: DashboardFilters;
  generatedAt: string;
};

export type FilterOptionsResponse = {
  customers: string[];
  factories: string[];
  soNumbers: string[];
  styles: string[];
  lines: string[];
  defectDescriptions: string[];
  inspectionStages: InspectionStage[];
  dateRange?: {
    startDate?: string | null;
    endDate?: string | null;
  };
  defaultCustomer?: string;
  defaultFactory?: string;
  minDate?: string;
  maxDate?: string;
  latestRefreshDate?: string | null;
  meta?: ApiMeta;
};

export type KpiCardData = {
  stage: InspectionStage;
  defects: number;
  denominator: number;
  rate: number;
  target: number;
  status: StatusLevel;
};

export type MonthlyTrendItem = {
  month: string;
  monthStart?: string;
  monthNumber?: number;
  inline: number;
  endline: number;
  preFinal: number;
  final: number;
  thirdParty: number;
};

export type WeeklyTrendItem = {
  weekStart?: string;
  isoWeek: string;
  weekNumber: number;
  month: string;
  inline: number;
  endline: number;
  preFinal: number;
  final: number;
  thirdParty: number;
};

export type OverviewResponse = {
  kpiCards: KpiCardData[];
  monthlyTrend: MonthlyTrendItem[];
  scanQty: {
    sewQty: number;
    enQty: number;
    fgQty: number;
  };
  latestRefreshDate?: string | null;
  meta?: ApiMeta;
};

export type DefectCategoryRow = Record<InspectionStage, number> & {
  name: string;
  total: number;
};

export type DefectCategoryDetailRow = {
  defectDescription: string;
  inspectionStage: InspectionStage;
  defects: number;
  denominator: number;
  rate: number;
  share: number;
};

export type DefectCategoryResponse = {
  topCategories: DefectCategoryRow[];
  detailTable: DefectCategoryDetailRow[];
  totals: {
    defectQty: number;
    byStage: Partial<Record<InspectionStage, number>>;
    denominatorByStage: Partial<Record<InspectionStage, number>>;
  };
  meta?: ApiMeta;
};

export type LineRateRow = Partial<Record<InspectionStage, number>> & {
  name: string;
  line: string;
  fac_line?: string;
  totalDefects: number;
  denominator: number;
  rate: number;
  mainStage: InspectionStage;
  topDefect?: string | null;
  status: StatusLevel;
};

export type LineDefectDetailRow = {
  line: string;
  fac_line?: string;
  defectDescription: string;
  inspectionStage: InspectionStage;
  defects: number;
  denominator: number;
  rate: number;
};

export type LineAnalysisResponse = {
  lineLevelDefectRates: LineRateRow[];
  lineDefectDetailTable: LineDefectDetailRow[];
  totals: {
    lineCount: number;
    defectQty: number;
    denominator: number;
  };
  meta?: ApiMeta;
};

export type StageDetailResponse = {
  stage: InspectionStage;
  selectedStageKpiSummary: KpiCardData & {
    activeSoCount: number;
    activeLineCount: number;
  };
  donutValues: Array<{
    name: string;
    value: number;
    color: string;
  }>;
  topDefects: Array<{
    name: string;
    defects: number;
    rate: number;
    share: number;
    status: StatusLevel;
  }>;
  trend: WeeklyTrendItem[];
  detailTable: Array<{
    defectDescription: string;
    defects: number;
    denominator: number;
    rate: number;
    share: number;
    status: StatusLevel;
  }>;
  meta?: ApiMeta;
};

export type WeeklyTrendResponse = {
  weeklyTrend: WeeklyTrendItem[];
  meta?: ApiMeta;
};

export type HealthResponse = {
  status: string;
  db: string;
  timestamp: string;
};
