export type InspectionStage =
  | "Inline"
  | "Endline"
  | "Pre Final"
  | "Final"
  | "Third Party";

export type Customer = string;

export type QualityRecord = {
  date: string;
  month: string;
  iso_week: string;
  customer: Customer;
  factory: string;
  line: string;
  so_number: string;
  style: string;
  inspection_stage: InspectionStage;
  defect_desc_eng: string;
  defect_qty: number;
  inspected_qty: number;
  process_checks: number;
};

export type FilterState = {
  customer: Customer;
  dateFrom: string;
  dateTo: string;
  weekNumbers: string[];
  factory: string;
  soNumbers: string[];
  styles: string[];
  lines: string[];
  defectDescriptions: string[];
  inspectionCategories: InspectionStage[];
};

export type StatusLevel = "Good" | "Watch" | "Critical";

export type StageKpi = {
  stage: InspectionStage;
  defects: number;
  denominator: number;
  rate: number;
  target: number;
  status: StatusLevel;
};

export type DefectSummaryRow = {
  name: string;
  defects: number;
  rate: number;
  share: number;
  status: StatusLevel;
};

export type LineRiskRow = {
  line: string;
  defects: number;
  denominator: number;
  rate: number;
  mainStage: InspectionStage;
  topDefect: string;
  status: StatusLevel;
};
