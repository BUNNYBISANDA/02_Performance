import { timedQuery } from "../db/timedQuery.js";
import {
  buildQualityWhereClause,
  type QualityFilters,
  withInspectionStage,
} from "./qualityFilters.js";

export const inspectionStages = ["Inline", "Endline", "Pre Final", "Final", "Third Party"] as const;

type InspectionStage = (typeof inspectionStages)[number];

const stageTargets: Record<InspectionStage, number> = {
  Inline: 3.5,
  Endline: 2,
  "Pre Final": 1.2,
  Final: 0.7,
  "Third Party": 0.5,
};

const stageColors: Record<InspectionStage, string> = {
  Inline: "#00AEEF",
  Endline: "#123C69",
  "Pre Final": "#F28C28",
  Final: "#7C3AED",
  "Third Party": "#D946EF",
};

const stageValuesSql = inspectionStages
  .map((stage, index) => `('${stage}', ${index + 1}, ${stageTargets[stage]})`)
  .join(", ");

const stageKey = (stage: string) => {
  if (stage === "Pre Final") return "preFinal";
  if (stage === "Third Party") return "thirdParty";
  return stage.charAt(0).toLowerCase() + stage.slice(1);
};

const denominatorExpression = `
  CASE
    WHEN inspection_stage = 'Inline' THEN COALESCE(process_checks, 0)
    ELSE COALESCE(inspected_qty, 0)
  END
`;

const round = (value: number, decimals = 2) => Number(value.toFixed(decimals));

const toNumber = (value: unknown) => {
  if (value === null || value === undefined) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const statusForRate = (stage: InspectionStage, rate: number) => {
  const target = stageTargets[stage];
  if (rate <= target) return "Good";
  if (rate <= target * 1.35) return "Watch";
  return "Critical";
};

const normalizeStage = (stage: string): InspectionStage => {
  if (inspectionStages.includes(stage as InspectionStage)) return stage as InspectionStage;
  return "Inline";
};

const baseCte = (filters: QualityFilters) => {
  const { whereSql, values } = buildQualityWhereClause(filters, { alias: "q" });

  return {
    values,
    sql: `
      WITH filtered AS (
        SELECT
          q.inspection_stage,
          q.inspection_date,
          q.factory,
          q.customer,
          q.so_no_doc,
          q.so_no,
          q.so_year,
          q.style,
          q.style_ref,
          q.fac_line,
          q.defect_code,
          q.defect_desc_eng,
          COALESCE(q.defect_qty, 0)::numeric AS defect_qty,
          COALESCE(q.inspected_qty, 0)::numeric AS inspected_qty,
          COALESCE(q.process_checks, 0)::numeric AS process_checks,
          q.denominator_key,
          q.source_table
        FROM o2.mv_quality_defects_unified q
        ${whereSql}
      )
    `,
  };
};

const toIsoDate = (value: unknown) => {
  if (!value) return null;
  if (value instanceof Date) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  return String(value).slice(0, 10);
};

const publicFilters = (filters: QualityFilters) => ({
  customer: filters.customer ?? null,
  factory: filters.factory ?? null,
  startDate: filters.startDate ?? null,
  endDate: filters.endDate ?? null,
  weekNumbers: filters.weekNumbers,
  soNumbers: filters.soNumbers,
  styles: filters.styles,
  lines: filters.lines,
  defectDescriptions: filters.defectDescriptions,
  inspectionStages: filters.inspectionStages,
});

const makeMeta = (filters: QualityFilters, rowCount: number) => ({
  rowCount,
  appliedFilters: publicFilters(filters),
  generatedAt: new Date().toISOString(),
});

const getFilteredRowCount = async (filters: QualityFilters) => {
  const base = baseCte(filters);
  const result = await timedQuery(
    "shared.filtered-row-count",
    `
      ${base.sql}
      SELECT COUNT(*)::int AS row_count
      FROM filtered
    `,
    base.values,
  );

  return toNumber(result.rows[0]?.row_count);
};

const getLatestRefreshDate = async () => {
  const result = await timedQuery("shared.latest-refresh", `
    SELECT refresh_date
    FROM o2.v_latest_refresh_date
  `);

  return toIsoDate(result.rows[0]?.refresh_date);
};

const getFilterDefaults = async () => {
  const result = await timedQuery("filters.defaults", `
    WITH customer_counts AS (
      SELECT customer, COUNT(*)::int AS row_count
      FROM o2.mv_quality_defects_unified
      WHERE NULLIF(TRIM(customer), '') IS NOT NULL
      GROUP BY customer
    ),
    factory_counts AS (
      SELECT factory, COUNT(*)::int AS row_count
      FROM o2.mv_quality_defects_unified
      WHERE NULLIF(TRIM(factory), '') IS NOT NULL
      GROUP BY factory
    ),
    date_range AS (
      SELECT MIN(inspection_date) AS min_date, MAX(inspection_date) AS max_date
      FROM o2.mv_quality_defects_unified
      WHERE inspection_date IS NOT NULL
    )
    SELECT
      COALESCE(
        (SELECT customer FROM customer_counts WHERE LOWER(TRIM(customer)) = 'travis mathew' ORDER BY row_count DESC LIMIT 1),
        (SELECT customer FROM customer_counts ORDER BY row_count DESC, customer LIMIT 1)
      ) AS default_customer,
      COALESCE(
        (SELECT factory FROM factory_counts WHERE LOWER(TRIM(factory)) = 'g3' ORDER BY row_count DESC LIMIT 1),
        (SELECT factory FROM factory_counts WHERE LOWER(TRIM(factory)) = 'ea' ORDER BY row_count DESC LIMIT 1),
        (SELECT factory FROM factory_counts ORDER BY row_count DESC, factory LIMIT 1)
      ) AS default_factory,
      (SELECT min_date FROM date_range) AS min_date,
      (SELECT max_date FROM date_range) AS max_date
  `);

  const row = result.rows[0] ?? {};
  const minDate = toIsoDate(row.min_date) ?? "";
  const maxDate = toIsoDate(row.max_date) ?? "";
  const reportStartDate = "2026-01-05";
  const reportEndDate = "2026-06-04";
  const hasReportRange =
    (!minDate || minDate <= reportStartDate) &&
    (!maxDate || maxDate >= reportEndDate);

  return {
    defaultCustomer: row.default_customer ?? "",
    defaultFactory: row.default_factory ?? "",
    minDate,
    maxDate,
    defaultStartDate: hasReportRange ? reportStartDate : minDate,
    defaultEndDate: hasReportRange ? reportEndDate : maxDate,
  };
};

const buildScanWhereClause = (filters: QualityFilters) => {
  const conditions: string[] = [];
  const values: unknown[] = [];

  const pushValue = (value: unknown) => {
    values.push(value);
    return `$${values.length}`;
  };

  if (filters.customer) {
    conditions.push(`LOWER(TRIM(COALESCE(sq.customer, ''))) = LOWER(TRIM(${pushValue(filters.customer)}))`);
  }

  if (filters.factory) {
    conditions.push(`LOWER(TRIM(COALESCE(sq.factory_display, ''))) = LOWER(TRIM(${pushValue(filters.factory)}))`);
  }

  if (filters.startDate) {
    conditions.push(`sq.trx_date >= ${pushValue(filters.startDate)}::date`);
  }

  if (filters.endDate) {
    conditions.push(`sq.trx_date <= ${pushValue(filters.endDate)}::date`);
  }

  if (filters.soNumbers.length > 0) {
    conditions.push(`LOWER(TRIM(COALESCE(sq.so_no_doc, ''))) = ANY(${pushValue(filters.soNumbers.map((value) => value.trim().toLowerCase()))}::text[])`);
  }

  if (filters.styles.length > 0) {
    conditions.push(`LOWER(TRIM(COALESCE(sq.style, ''))) = ANY(${pushValue(filters.styles.map((value) => value.trim().toLowerCase()))}::text[])`);
  }

  return {
    whereSql: conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "",
    values,
  };
};

const getScanQuantitySummary = async (filters: QualityFilters) => {
  const scanWhere = buildScanWhereClause(filters);
  const result = await timedQuery(
    "overview.scan-quantity",
    `
      SELECT
        COALESCE(SUM(qty) FILTER (WHERE scan_qty_type = 'SEW QTY'), 0) AS sew_qty,
        COALESCE(SUM(qty) FILTER (WHERE scan_qty_type = 'EN QTY'), 0) AS en_qty,
        COALESCE(SUM(qty) FILTER (WHERE scan_qty_type = 'FG QTY'), 0) AS fg_qty
      FROM o2.mv_scan_qty sq
      ${scanWhere.whereSql}
    `,
    scanWhere.values,
  );

  return {
    sewQty: round(toNumber(result.rows[0]?.sew_qty), 0),
    enQty: round(toNumber(result.rows[0]?.en_qty), 0),
    fgQty: round(toNumber(result.rows[0]?.fg_qty), 0),
  };
};

const mapKpiRow = (row: Record<string, unknown>) => {
  const stage = normalizeStage(String(row.stage));
  const defects = toNumber(row.defects);
  const denominator = toNumber(row.denominator);
  const rate = denominator === 0 ? 0 : round((defects / denominator) * 100);

  return {
    stage,
    defects: round(defects, 0),
    denominator: round(denominator, 0),
    rate,
    target: stageTargets[stage],
    status: statusForRate(stage, rate),
  };
};

const stageOrderCase = (field = "inspection_stage") => `
  CASE ${field}
    WHEN 'Inline' THEN 1
    WHEN 'Endline' THEN 2
    WHEN 'Pre Final' THEN 3
    WHEN 'Final' THEN 4
    WHEN 'Third Party' THEN 5
    ELSE 99
  END
`;

const getFilterOptionsUncached = async (filters: QualityFilters) => {
  const base = baseCte(filters);
  const [result, defaults] = await Promise.all([
    timedQuery(
    "filters.options",
    `
      ${base.sql}
      SELECT
        (SELECT COUNT(*)::int FROM filtered) AS "rowCount",
        (
          SELECT COALESCE(json_agg(customer ORDER BY customer), '[]'::json)
          FROM (SELECT DISTINCT customer FROM filtered WHERE NULLIF(customer, '') IS NOT NULL) values
        ) AS customers,
        (
          SELECT COALESCE(json_agg(factory ORDER BY factory), '[]'::json)
          FROM (SELECT DISTINCT factory FROM filtered WHERE NULLIF(factory, '') IS NOT NULL) values
        ) AS factories,
        (
          SELECT COALESCE(json_agg(so_number ORDER BY so_number), '[]'::json)
          FROM (
            SELECT DISTINCT so_number
            FROM (
              SELECT so_no_doc AS so_number FROM filtered WHERE NULLIF(so_no_doc, '') IS NOT NULL
              UNION
              SELECT so_no AS so_number FROM filtered WHERE NULLIF(so_no, '') IS NOT NULL
            ) so_values
          ) values
        ) AS "soNumbers",
        (
          SELECT COALESCE(json_agg(style_value ORDER BY style_value), '[]'::json)
          FROM (
            SELECT DISTINCT style_value
            FROM (
              SELECT style AS style_value FROM filtered WHERE NULLIF(style, '') IS NOT NULL
              UNION
              SELECT style_ref AS style_value FROM filtered WHERE NULLIF(style_ref, '') IS NOT NULL
            ) style_values
          ) values
        ) AS styles,
        (
          SELECT COALESCE(json_agg(fac_line ORDER BY fac_line), '[]'::json)
          FROM (SELECT DISTINCT fac_line FROM filtered WHERE NULLIF(fac_line, '') IS NOT NULL) values
        ) AS lines,
        (
          SELECT COALESCE(json_agg(week_number ORDER BY week_number), '[]'::json)
          FROM (
            SELECT DISTINCT to_char(inspection_date, '"W"IW') AS week_number
            FROM filtered
            WHERE inspection_date IS NOT NULL
          ) values
        ) AS "weekNumbers",
        (
          SELECT COALESCE(json_agg(defect_desc_eng ORDER BY defect_desc_eng), '[]'::json)
          FROM (SELECT DISTINCT defect_desc_eng FROM filtered WHERE NULLIF(defect_desc_eng, '') IS NOT NULL) values
        ) AS "defectDescriptions",
        (
          SELECT COALESCE(json_agg(inspection_stage ORDER BY ${stageOrderCase("inspection_stage")}), '[]'::json)
          FROM (
            SELECT DISTINCT inspection_stage
            FROM filtered
            WHERE NULLIF(inspection_stage, '') IS NOT NULL
          ) values
        ) AS "inspectionStages",
        (
          SELECT json_build_object(
            'startDate', MIN(inspection_date),
            'endDate', MAX(inspection_date)
          )
          FROM filtered
        ) AS "dateRange",
        (
          SELECT refresh_date
          FROM o2.v_latest_refresh_date
        ) AS "latestRefreshDate"
    `,
    base.values,
    ),
    getFilterDefaults(),
  ]);

  const row = result.rows[0] ?? {};
  const rowCount = toNumber(row.rowCount);

  return {
    customers: row.customers ?? [],
    factories: row.factories ?? [],
    soNumbers: row.soNumbers ?? [],
    styles: row.styles ?? [],
    lines: row.lines ?? [],
    weekNumbers: row.weekNumbers ?? [],
    defectDescriptions: row.defectDescriptions ?? [],
    inspectionStages: row.inspectionStages ?? [],
    defaultCustomer: defaults.defaultCustomer,
    defaultFactory: defaults.defaultFactory,
    minDate: defaults.minDate,
    maxDate: defaults.maxDate,
    dateRange: {
      startDate: filters.startDate ?? defaults.defaultStartDate,
      endDate: filters.endDate ?? defaults.defaultEndDate,
    },
    latestRefreshDate: toIsoDate(row.latestRefreshDate),
    meta: makeMeta(filters, rowCount),
  };
};

const filterOptionsCache = new Map<
  string,
  { expiresAt: number; promise: ReturnType<typeof getFilterOptionsUncached> }
>();
const filterOptionsTtlMs = 5 * 60 * 1000;

export const getFilterOptions = (filters: QualityFilters) => {
  const cacheKey = JSON.stringify(filters);
  const cached = filterOptionsCache.get(cacheKey);

  if (cached && cached.expiresAt > Date.now()) {
    console.info(`[cache] filters hit key=${cacheKey}`);
    return cached.promise;
  }

  const promise = getFilterOptionsUncached(filters).catch((error) => {
    filterOptionsCache.delete(cacheKey);
    throw error;
  });
  filterOptionsCache.set(cacheKey, {
    expiresAt: Date.now() + filterOptionsTtlMs,
    promise,
  });
  return promise;
};

export const getOverview = async (filters: QualityFilters) => {
  const base = baseCte(filters);

  const kpiPromise = timedQuery(
    "overview.kpis",
    `
      ${base.sql},
      stage_list(stage, sort_order, target) AS (VALUES ${stageValuesSql}),
      stage_defects AS (
        SELECT inspection_stage, SUM(defect_qty) AS defects
        FROM filtered
        GROUP BY inspection_stage
      ),
      stage_denominators AS (
        SELECT inspection_stage, SUM(denominator) AS denominator
        FROM (
          SELECT inspection_stage, denominator_key, MAX(${denominatorExpression}) AS denominator
          FROM filtered
          GROUP BY inspection_stage, denominator_key
        ) denominator_rows
        GROUP BY inspection_stage
      )
      SELECT
        stage_list.stage,
        stage_list.target,
        COALESCE(stage_defects.defects, 0) AS defects,
        COALESCE(stage_denominators.denominator, 0) AS denominator
      FROM stage_list
      LEFT JOIN stage_defects ON stage_defects.inspection_stage = stage_list.stage
      LEFT JOIN stage_denominators ON stage_denominators.inspection_stage = stage_list.stage
      ORDER BY stage_list.sort_order
    `,
    base.values,
  );

  const monthlyPromise = timedQuery(
    "overview.monthly-trend",
    `
      ${base.sql},
      month_stage_defects AS (
        SELECT
          date_trunc('month', inspection_date)::date AS month_start,
          inspection_stage,
          SUM(defect_qty) AS defects
        FROM filtered
        WHERE inspection_date IS NOT NULL
        GROUP BY month_start, inspection_stage
      ),
      month_stage_denominators AS (
        SELECT
          month_start,
          inspection_stage,
          SUM(denominator) AS denominator
        FROM (
          SELECT
            date_trunc('month', inspection_date)::date AS month_start,
            inspection_stage,
            denominator_key,
            MAX(${denominatorExpression}) AS denominator
          FROM filtered
          WHERE inspection_date IS NOT NULL
          GROUP BY month_start, inspection_stage, denominator_key
        ) denominator_rows
        GROUP BY month_start, inspection_stage
      )
      SELECT
        to_char(COALESCE(month_stage_defects.month_start, month_stage_denominators.month_start), 'YYYY-MM-DD') AS month_start,
        extract(month from COALESCE(month_stage_defects.month_start, month_stage_denominators.month_start))::int AS month_number,
        to_char(COALESCE(month_stage_defects.month_start, month_stage_denominators.month_start), 'Mon') AS month,
        COALESCE(month_stage_defects.inspection_stage, month_stage_denominators.inspection_stage) AS inspection_stage,
        COALESCE(month_stage_defects.defects, 0) AS defects,
        COALESCE(month_stage_denominators.denominator, 0) AS denominator
      FROM month_stage_defects
      FULL OUTER JOIN month_stage_denominators
        ON month_stage_denominators.month_start = month_stage_defects.month_start
       AND month_stage_denominators.inspection_stage = month_stage_defects.inspection_stage
      ORDER BY month_start, ${stageOrderCase("COALESCE(month_stage_defects.inspection_stage, month_stage_denominators.inspection_stage)")}
    `,
    base.values,
  );

  const [kpiResult, monthlyResult, rowCount, scanQty, latestRefreshDate] = await Promise.all([
    kpiPromise,
    monthlyPromise,
    getFilteredRowCount(filters),
    getScanQuantitySummary(filters),
    getLatestRefreshDate(),
  ]);

  const kpiCards = kpiResult.rows.map(mapKpiRow);
  const monthlyRows = new Map<string, Record<string, string | number>>();

  for (const row of monthlyResult.rows) {
    const monthStart = String(row.month_start);
    const stage = String(row.inspection_stage);
    const defects = toNumber(row.defects);
    const denominator = toNumber(row.denominator);
    const rate = denominator === 0 ? 0 : round((defects / denominator) * 100);
    const existing = monthlyRows.get(monthStart) ?? {
      month: String(row.month).trim(),
      monthStart,
      monthNumber: toNumber(row.month_number),
      inline: 0,
      endline: 0,
      preFinal: 0,
      final: 0,
      thirdParty: 0,
    };

    existing[stageKey(stage)] = rate;
    monthlyRows.set(monthStart, existing);
  }

  return {
    kpiCards,
    monthlyTrend: [...monthlyRows.values()],
    scanQty,
    latestRefreshDate,
    meta: makeMeta(filters, rowCount),
  };
};

export const getWeeklyTrend = async (filters: QualityFilters) => {
  const base = baseCte(filters);
  const [result, rowCount] = await Promise.all([
    timedQuery(
    "weekly.trend",
    `
      ${base.sql},
      week_stage_defects AS (
        SELECT
          date_trunc('week', inspection_date)::date AS week_start,
          inspection_stage,
          SUM(defect_qty) AS defects
        FROM filtered
        WHERE inspection_date IS NOT NULL
        GROUP BY week_start, inspection_stage
      ),
      week_stage_denominators AS (
        SELECT
          week_start,
          inspection_stage,
          SUM(denominator) AS denominator
        FROM (
          SELECT
            date_trunc('week', inspection_date)::date AS week_start,
            inspection_stage,
            denominator_key,
            MAX(${denominatorExpression}) AS denominator
          FROM filtered
          WHERE inspection_date IS NOT NULL
          GROUP BY week_start, inspection_stage, denominator_key
        ) denominator_rows
        GROUP BY week_start, inspection_stage
      )
      SELECT
        to_char(COALESCE(week_stage_defects.week_start, week_stage_denominators.week_start), 'YYYY-MM-DD') AS week_start,
        to_char(COALESCE(week_stage_defects.week_start, week_stage_denominators.week_start), 'IYYY-"W"IW') AS iso_week,
        extract(week from COALESCE(week_stage_defects.week_start, week_stage_denominators.week_start))::int AS week_number,
        to_char(COALESCE(week_stage_defects.week_start, week_stage_denominators.week_start), 'Mon') AS month,
        COALESCE(week_stage_defects.inspection_stage, week_stage_denominators.inspection_stage) AS inspection_stage,
        COALESCE(week_stage_defects.defects, 0) AS defects,
        COALESCE(week_stage_denominators.denominator, 0) AS denominator
      FROM week_stage_defects
      FULL OUTER JOIN week_stage_denominators
        ON week_stage_denominators.week_start = week_stage_defects.week_start
       AND week_stage_denominators.inspection_stage = week_stage_defects.inspection_stage
      ORDER BY week_start, ${stageOrderCase("COALESCE(week_stage_defects.inspection_stage, week_stage_denominators.inspection_stage)")}
    `,
    base.values,
    ),
    getFilteredRowCount(filters),
  ]);

  const weeks = new Map<string, Record<string, string | number>>();

  for (const row of result.rows) {
    const weekStart = String(row.week_start);
    const stage = String(row.inspection_stage);
    const key = stageKey(stage);
    const defects = toNumber(row.defects);
    const denominator = toNumber(row.denominator);
    const rate = denominator === 0 ? 0 : round((defects / denominator) * 100);
    const existing = weeks.get(weekStart) ?? {
      weekStart,
      isoWeek: String(row.iso_week),
      weekNumber: toNumber(row.week_number),
      month: String(row.month).trim(),
      inline: 0,
      endline: 0,
      preFinal: 0,
      final: 0,
      thirdParty: 0,
    };

    existing[key] = rate;
    weeks.set(weekStart, existing);
  }

  return { weeklyTrend: [...weeks.values()], meta: makeMeta(filters, rowCount) };
};

export const getDailyTrend = async (filters: QualityFilters) => {
  const base = baseCte(filters);
  const [result, rowCount] = await Promise.all([
    timedQuery(
      "stage.daily-trend",
      `
        ${base.sql},
        selected_weeks AS (
          SELECT DISTINCT date_trunc('week', inspection_date)::date AS week_start
          FROM filtered
          WHERE inspection_date IS NOT NULL
        ),
        selected_stages AS (
          SELECT DISTINCT inspection_stage
          FROM filtered
          WHERE NULLIF(inspection_stage, '') IS NOT NULL
        ),
        calendar_days AS (
          SELECT
            (selected_weeks.week_start + day_offset)::date AS inspection_day,
            selected_stages.inspection_stage
          FROM selected_weeks
          CROSS JOIN generate_series(0, 6) AS offsets(day_offset)
          CROSS JOIN selected_stages
        ),
        day_stage_defects AS (
          SELECT
            inspection_date::date AS inspection_day,
            inspection_stage,
            SUM(defect_qty) AS defects
          FROM filtered
          WHERE inspection_date IS NOT NULL
          GROUP BY inspection_day, inspection_stage
        ),
        day_stage_denominators AS (
          SELECT
            inspection_day,
            inspection_stage,
            SUM(denominator) AS denominator
          FROM (
            SELECT
              inspection_date::date AS inspection_day,
              inspection_stage,
              denominator_key,
              MAX(${denominatorExpression}) AS denominator
            FROM filtered
            WHERE inspection_date IS NOT NULL
            GROUP BY inspection_day, inspection_stage, denominator_key
          ) denominator_rows
          GROUP BY inspection_day, inspection_stage
        )
        SELECT
          to_char(calendar_days.inspection_day, 'YYYY-MM-DD') AS inspection_date,
          to_char(calendar_days.inspection_day, 'Mon DD') AS label,
          to_char(calendar_days.inspection_day, 'IYYY-"W"IW') AS iso_week,
          extract(week from calendar_days.inspection_day)::int AS week_number,
          to_char(calendar_days.inspection_day, 'Mon') AS month,
          calendar_days.inspection_stage,
          COALESCE(day_stage_defects.defects, 0) AS defects,
          COALESCE(day_stage_denominators.denominator, 0) AS denominator
        FROM calendar_days
        LEFT JOIN day_stage_defects
          ON day_stage_defects.inspection_day = calendar_days.inspection_day
         AND day_stage_defects.inspection_stage = calendar_days.inspection_stage
        LEFT JOIN day_stage_denominators
          ON day_stage_denominators.inspection_day = calendar_days.inspection_day
         AND day_stage_denominators.inspection_stage = calendar_days.inspection_stage
        ORDER BY calendar_days.inspection_day, ${stageOrderCase("calendar_days.inspection_stage")}
      `,
      base.values,
    ),
    getFilteredRowCount(filters),
  ]);

  const days = new Map<string, Record<string, string | number>>();
  for (const row of result.rows) {
    const date = String(row.inspection_date);
    const stage = String(row.inspection_stage);
    const defects = toNumber(row.defects);
    const denominator = toNumber(row.denominator);
    const existing = days.get(date) ?? {
      date,
      label: String(row.label).trim(),
      weekStart: date,
      isoWeek: String(row.iso_week),
      weekNumber: toNumber(row.week_number),
      month: String(row.month).trim(),
      inline: 0,
      endline: 0,
      preFinal: 0,
      final: 0,
      thirdParty: 0,
    };

    existing[stageKey(stage)] = denominator === 0 ? 0 : round((defects / denominator) * 100);
    days.set(date, existing);
  }

  return { dailyTrend: [...days.values()], meta: makeMeta(filters, rowCount) };
};

export const getDefectCategories = async (filters: QualityFilters) => {
  const base = baseCte(filters);
  const [result, rowCount] = await Promise.all([
    timedQuery(
    "defects.categories",
    `
      ${base.sql},
      stage_denominators AS (
        SELECT inspection_stage, SUM(denominator) AS denominator
        FROM (
          SELECT inspection_stage, denominator_key, MAX(${denominatorExpression}) AS denominator
          FROM filtered
          GROUP BY inspection_stage, denominator_key
        ) denominator_rows
        GROUP BY inspection_stage
      ),
      defect_stage AS (
        SELECT
          COALESCE(NULLIF(defect_desc_eng, ''), 'Unmapped') AS defect_description,
          inspection_stage,
          SUM(defect_qty) AS defects
        FROM filtered
        GROUP BY defect_description, inspection_stage
      )
      SELECT
        defect_stage.defect_description,
        defect_stage.inspection_stage,
        defect_stage.defects,
        COALESCE(stage_denominators.denominator, 0) AS denominator
      FROM defect_stage
      LEFT JOIN stage_denominators ON stage_denominators.inspection_stage = defect_stage.inspection_stage
      ORDER BY defect_stage.defects DESC, defect_stage.defect_description
    `,
    base.values,
    ),
    getFilteredRowCount(filters),
  ]);

  const byDefect = new Map<string, Record<string, string | number>>();
  const totalsByStage: Record<string, number> = {};
  const denominatorsByStage: Record<string, number> = {};

  for (const row of result.rows) {
    const name = String(row.defect_description);
    const stage = String(row.inspection_stage);
    const defects = toNumber(row.defects);
    const denominator = toNumber(row.denominator);
    const existing = byDefect.get(name) ?? { name, total: 0 };

    existing[stage] = defects;
    existing.total = toNumber(existing.total) + defects;
    byDefect.set(name, existing);
    totalsByStage[stage] = (totalsByStage[stage] ?? 0) + defects;
    denominatorsByStage[stage] = denominator;
  }

  const rows = [...byDefect.values()].sort((a, b) => toNumber(b.total) - toNumber(a.total));
  const totalDefects = Object.values(totalsByStage).reduce((sum, value) => sum + value, 0);

  const detailTable = result.rows.map((row) => {
    const stage = normalizeStage(String(row.inspection_stage));
    const defects = toNumber(row.defects);
    const denominator = toNumber(row.denominator);

    return {
      defectDescription: String(row.defect_description),
      inspectionStage: stage,
      defects: round(defects, 0),
      denominator: round(denominator, 0),
      rate: denominator === 0 ? 0 : round((defects / denominator) * 100),
      share: totalDefects === 0 ? 0 : round((defects / totalDefects) * 100),
    };
  });

  return {
    topCategories: rows.slice(0, 20),
    detailTable: detailTable.slice(0, 250),
    totals: {
      defectQty: round(totalDefects, 0),
      byStage: totalsByStage,
      denominatorByStage: denominatorsByStage,
    },
    meta: makeMeta(filters, rowCount),
  };
};

export const getLineAnalysis = async (filters: QualityFilters) => {
  const base = baseCte(filters);
  const linePromise = timedQuery(
    "lines.summary",
    `
      ${base.sql},
      line_stage_defects AS (
        SELECT
          COALESCE(NULLIF(fac_line, ''), 'Unassigned') AS line,
          inspection_stage,
          SUM(defect_qty) AS defects
        FROM filtered
        GROUP BY line, inspection_stage
      ),
      line_stage_denominators AS (
        SELECT
          line,
          inspection_stage,
          SUM(denominator) AS denominator
        FROM (
          SELECT
            COALESCE(NULLIF(fac_line, ''), 'Unassigned') AS line,
            inspection_stage,
            denominator_key,
            MAX(${denominatorExpression}) AS denominator
          FROM filtered
          GROUP BY line, inspection_stage, denominator_key
        ) denominator_rows
        GROUP BY line, inspection_stage
      )
      SELECT
        COALESCE(line_stage_defects.line, line_stage_denominators.line) AS line,
        COALESCE(line_stage_defects.inspection_stage, line_stage_denominators.inspection_stage) AS inspection_stage,
        COALESCE(line_stage_defects.defects, 0) AS defects,
        COALESCE(line_stage_denominators.denominator, 0) AS denominator
      FROM line_stage_defects
      FULL OUTER JOIN line_stage_denominators
        ON line_stage_denominators.line = line_stage_defects.line
       AND line_stage_denominators.inspection_stage = line_stage_defects.inspection_stage
      ORDER BY line, ${stageOrderCase("COALESCE(line_stage_defects.inspection_stage, line_stage_denominators.inspection_stage)")}
    `,
    base.values,
  );

  const detailPromise = timedQuery(
    "lines.detail",
    `
      ${base.sql}
      SELECT
        COALESCE(NULLIF(fac_line, ''), 'Unassigned') AS line,
        COALESCE(NULLIF(defect_desc_eng, ''), 'Unmapped') AS defect_description,
        inspection_stage,
        SUM(defect_qty) AS defects
      FROM filtered
      GROUP BY line, defect_description, inspection_stage
      ORDER BY line, defects DESC, defect_description
    `,
    base.values,
  );

  const [lineResult, detailResult, rowCount] = await Promise.all([
    linePromise,
    detailPromise,
    getFilteredRowCount(filters),
  ]);

  const byLine = new Map<string, Record<string, string | number>>();
  const denominatorByLineStage = new Map<string, number>();
  const topDefectByLine = new Map<string, { name: string; defects: number }>();

  for (const row of lineResult.rows) {
    const line = String(row.line);
    const stage = normalizeStage(String(row.inspection_stage));
    const defects = toNumber(row.defects);
    const denominator = toNumber(row.denominator);
    const rate = denominator === 0 ? 0 : round((defects / denominator) * 100);
    const existing = byLine.get(line) ?? {
      name: line,
      line,
      totalDefects: 0,
      denominator: 0,
      rate: 0,
      mainStage: stage,
    };

    existing[stage] = rate;
    existing.totalDefects = toNumber(existing.totalDefects) + defects;
    existing.denominator = toNumber(existing.denominator) + denominator;
    denominatorByLineStage.set(`${line}|${stage}`, denominator);
    byLine.set(line, existing);
  }

  for (const row of detailResult.rows) {
    const line = String(row.line);
    const defects = toNumber(row.defects);
    const current = topDefectByLine.get(line);

    if (!current || defects > current.defects) {
      topDefectByLine.set(line, {
        name: String(row.defect_description),
        defects,
      });
    }
  }

  const lineLevelDefectRates = [...byLine.values()].map((row) => {
    const denominator = toNumber(row.denominator);
    const rate = denominator === 0 ? 0 : round((toNumber(row.totalDefects) / denominator) * 100);
    const line = String(row.line);
    const stageRates = inspectionStages
      .map((stage) => ({ stage, rate: toNumber(row[stage]) }))
      .sort((a, b) => b.rate - a.rate);
    const mainStage = stageRates[0]?.stage ?? "Inline";

    return {
      ...row,
      denominator: round(denominator, 0),
      totalDefects: round(toNumber(row.totalDefects), 0),
      rate,
      mainStage,
      topDefect: topDefectByLine.get(line)?.name ?? null,
      status: statusForRate(mainStage, stageRates[0]?.rate ?? rate),
    };
  });

  const lineDefectDetailTable = detailResult.rows.map((row) => {
    const line = String(row.line);
    const stage = normalizeStage(String(row.inspection_stage));
    const defects = toNumber(row.defects);
    const denominator = denominatorByLineStage.get(`${line}|${stage}`) ?? 0;

    return {
      line,
      defectDescription: String(row.defect_description),
      inspectionStage: stage,
      defects: round(defects, 0),
      denominator: round(denominator, 0),
      rate: denominator === 0 ? 0 : round((defects / denominator) * 100),
    };
  });

  return {
    lineLevelDefectRates: lineLevelDefectRates.sort((a, b) => toNumber(b.rate) - toNumber(a.rate)),
    lineDefectDetailTable: lineDefectDetailTable.slice(0, 500),
    totals: {
      lineCount: lineLevelDefectRates.length,
      defectQty: round(lineLevelDefectRates.reduce((sum, row) => sum + toNumber(row.totalDefects), 0), 0),
      denominator: round(lineLevelDefectRates.reduce((sum, row) => sum + toNumber(row.denominator), 0), 0),
    },
    meta: makeMeta(filters, rowCount),
  };
};

export const getStageDetail = async (
  filters: QualityFilters,
  stageValue: string,
  granularity: "daily" | "weekly" = "weekly",
) => {
  const stage = normalizeStage(stageValue);
  const stageFilters = withInspectionStage(filters, stage);
  const base = baseCte(stageFilters);

  const statsPromise = timedQuery(
    "stage.stats",
    `
      ${base.sql},
      denominator_total AS (
        SELECT SUM(denominator) AS denominator
        FROM (
          SELECT denominator_key, MAX(${denominatorExpression}) AS denominator
          FROM filtered
          GROUP BY denominator_key
        ) denominator_rows
      )
      SELECT
        COUNT(*)::int AS row_count,
        COALESCE(SUM(defect_qty), 0) AS defects,
        COALESCE((SELECT denominator FROM denominator_total), 0) AS denominator,
        COUNT(DISTINCT so_no_doc) FILTER (WHERE NULLIF(so_no_doc, '') IS NOT NULL) AS active_so_count,
        COUNT(DISTINCT fac_line) FILTER (WHERE NULLIF(fac_line, '') IS NOT NULL) AS active_line_count
      FROM filtered
    `,
    base.values,
  );

  const defectsPromise = timedQuery(
    "stage.defects",
    `
      ${base.sql}
      SELECT
        COALESCE(NULLIF(defect_desc_eng, ''), 'Unmapped') AS defect_description,
        SUM(defect_qty) AS defects
      FROM filtered
      GROUP BY defect_description
      ORDER BY defects DESC, defect_description
      LIMIT 50
    `,
    base.values,
  );

  const trendPromise = granularity === "daily"
    ? getDailyTrend(stageFilters).then((result) => result.dailyTrend)
    : getWeeklyTrend(stageFilters).then((result) => result.weeklyTrend);

  const [statsResult, defectsResult, trend] = await Promise.all([
    statsPromise,
    defectsPromise,
    trendPromise,
  ]);
  const stats = statsResult.rows[0] ?? {};
  const defects = toNumber(stats.defects);
  const denominator = toNumber(stats.denominator);
  const rate = denominator === 0 ? 0 : round((defects / denominator) * 100);
  const totalDefects = defectsResult.rows.reduce((sum, row) => sum + toNumber(row.defects), 0);
  const topDefects = defectsResult.rows.slice(0, 10).map((row) => {
    const defectQty = toNumber(row.defects);

    return {
      name: String(row.defect_description),
      defects: round(defectQty, 0),
      rate: denominator === 0 ? 0 : round((defectQty / denominator) * 100),
      share: totalDefects === 0 ? 0 : round((defectQty / totalDefects) * 100),
      status: totalDefects === 0 || defectQty / totalDefects < 0.1 ? "Good" : defectQty / totalDefects < 0.18 ? "Watch" : "Critical",
    };
  });

  return {
    stage,
    selectedStageKpiSummary: {
      stage,
      defects: round(defects, 0),
      denominator: round(denominator, 0),
      rate,
      target: stageTargets[stage],
      status: statusForRate(stage, rate),
      activeSoCount: toNumber(stats.active_so_count),
      activeLineCount: toNumber(stats.active_line_count),
    },
    donutValues: [
      { name: `${stage} Defect Qty`, value: round(defects, 0), color: stageColors[stage] },
      {
        name: stage === "Inline" ? "Passed Process Checks" : "Passed Garments",
        value: round(Math.max(denominator - defects, 0), 0),
        color: "#CBD5E1",
      },
    ],
    topDefects,
    trend,
    detailTable: topDefects.map((row) => ({
      defectDescription: row.name,
      defects: row.defects,
      denominator: round(denominator, 0),
      rate: row.rate,
      share: row.share,
      status: row.status,
    })),
    meta: makeMeta(stageFilters, toNumber(stats.row_count)),
  };
};
