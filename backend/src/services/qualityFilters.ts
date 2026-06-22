import { z } from "zod";

export type QualityFilters = {
  customer?: string;
  factory?: string;
  startDate?: string;
  endDate?: string;
  soNumbers: string[];
  styles: string[];
  lines: string[];
  defectDescriptions: string[];
  inspectionStages: string[];
};

type QueryValue = string | string[] | undefined;

export class BadRequestError extends Error {
  statusCode = 400;
}

const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD date format")
  .optional();

const filtersSchema = z.object({
  customer: z.string().min(1).optional(),
  factory: z.string().min(1).optional(),
  startDate: dateString,
  endDate: dateString,
  soNumbers: z.array(z.string().min(1)),
  styles: z.array(z.string().min(1)),
  lines: z.array(z.string().min(1)),
  defectDescriptions: z.array(z.string().min(1)),
  inspectionStages: z.array(z.string().min(1)),
});

const firstValue = (value: QueryValue) => {
  if (Array.isArray(value)) return value[0];
  return value;
};

const parseText = (value: QueryValue) => {
  const text = firstValue(value)?.trim();
  if (!text || text.toLowerCase() === "all") return undefined;
  return text;
};

const parseCommaList = (value: QueryValue) => {
  const values = Array.isArray(value) ? value : value ? [value] : [];

  return values
    .flatMap((item) => item.split(","))
    .map((item) => item.trim())
    .filter((item) => item.length > 0 && item.toLowerCase() !== "all");
};

export const parseQualityFilters = (query: Record<string, QueryValue>): QualityFilters => {
  const parsed = filtersSchema.safeParse({
    customer: parseText(query.customer),
    factory: parseText(query.factory),
    startDate: parseText(query.startDate),
    endDate: parseText(query.endDate),
    soNumbers: parseCommaList(query.soNumbers),
    styles: parseCommaList(query.styles),
    lines: parseCommaList(query.lines),
    defectDescriptions: parseCommaList(query.defectDescriptions),
    inspectionStages: parseCommaList(query.inspectionStages),
  });

  if (!parsed.success) {
    const error = new BadRequestError(parsed.error.issues.map((issue) => issue.message).join("; "));
    throw error;
  }

  return parsed.data;
};

type BuildWhereOptions = {
  alias?: string;
  startIndex?: number;
};

export const buildQualityWhereClause = (
  filters: QualityFilters,
  options: BuildWhereOptions = {},
) => {
  const alias = options.alias ?? "q";
  const startIndex = options.startIndex ?? 1;
  const conditions: string[] = [];
  const values: unknown[] = [];

  const pushValue = (value: unknown) => {
    values.push(value);
    return `$${startIndex + values.length - 1}`;
  };

  if (filters.customer) {
    conditions.push(`LOWER(TRIM(COALESCE(${alias}.customer, ''))) = LOWER(TRIM(${pushValue(filters.customer)}))`);
  }

  if (filters.factory) {
    conditions.push(`LOWER(TRIM(COALESCE(${alias}.factory, ''))) = LOWER(TRIM(${pushValue(filters.factory)}))`);
  }

  if (filters.startDate) {
    conditions.push(`${alias}.inspection_date >= ${pushValue(filters.startDate)}::date`);
  }

  if (filters.endDate) {
    conditions.push(`${alias}.inspection_date <= ${pushValue(filters.endDate)}::date`);
  }

  if (filters.soNumbers.length > 0) {
    const normalizedValues = filters.soNumbers.map((value) => value.trim().toLowerCase());
    const param = pushValue(normalizedValues);
    conditions.push(`(
      LOWER(TRIM(COALESCE(${alias}.so_no_doc, ''))) = ANY(${param}::text[])
      OR LOWER(TRIM(COALESCE(${alias}.so_no, ''))) = ANY(${param}::text[])
    )`);
  }

  if (filters.styles.length > 0) {
    const normalizedValues = filters.styles.map((value) => value.trim().toLowerCase());
    const param = pushValue(normalizedValues);
    conditions.push(`(
      LOWER(TRIM(COALESCE(${alias}.style, ''))) = ANY(${param}::text[])
      OR LOWER(TRIM(COALESCE(${alias}.style_ref, ''))) = ANY(${param}::text[])
    )`);
  }

  const arrayFilters: Array<[string, string[]]> = [
    [`${alias}.fac_line`, filters.lines],
    [`${alias}.defect_desc_eng`, filters.defectDescriptions],
    [`${alias}.inspection_stage`, filters.inspectionStages],
  ];

  for (const [field, filterValues] of arrayFilters) {
    if (filterValues.length > 0) {
      const normalizedValues = filterValues.map((value) => value.trim().toLowerCase());
      conditions.push(`LOWER(TRIM(COALESCE(${field}, ''))) = ANY(${pushValue(normalizedValues)}::text[])`);
    }
  }

  return {
    whereSql: conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "",
    values,
  };
};

export const withInspectionStage = (filters: QualityFilters, stage: string): QualityFilters => ({
  ...filters,
  inspectionStages: [stage],
});
