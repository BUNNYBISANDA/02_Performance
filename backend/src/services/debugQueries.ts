import { pool } from "../db/pool.js";
import { buildQualityWhereClause, type QualityFilters } from "./qualityFilters.js";

const toNumber = (value: unknown) => {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
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

const makeMeta = (filters?: QualityFilters, rowCount?: number) => ({
  rowCount: rowCount ?? null,
  appliedFilters: filters ?? null,
  generatedAt: new Date().toISOString(),
});

const buildFilteredCte = (filters: QualityFilters) => {
  const { whereSql, values } = buildQualityWhereClause(filters, { alias: "q" });

  return {
    values,
    sql: `
      WITH filtered AS (
        SELECT *
        FROM o2.v_quality_defects_unified q
        ${whereSql}
      )
    `,
  };
};

const denominatorExpression = `
  CASE
    WHEN inspection_stage = 'Inline' THEN COALESCE(process_checks, 0)
    ELSE COALESCE(inspected_qty, 0)
  END
`;

const buildFnFgWhereClause = (filters: QualityFilters) => {
  const values: unknown[] = [];
  const conditions: string[] = [];
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
    values,
    whereSql: conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "",
  };
};

export const getDebugRowCounts = async () => {
  const result = await pool.query(`
    SELECT *
    FROM (VALUES
      ('o2.raw_data_inline', (SELECT COUNT(*)::bigint FROM o2.raw_data_inline)),
      ('o2.raw_data_endline', (SELECT COUNT(*)::bigint FROM o2.raw_data_endline)),
      ('o2.raw_data_prefinal', (SELECT COUNT(*)::bigint FROM o2.raw_data_prefinal)),
      ('o2.raw_data_final', (SELECT COUNT(*)::bigint FROM o2.raw_data_final)),
      ('o2.raw_data_3party', (SELECT COUNT(*)::bigint FROM o2.raw_data_3party)),
      ('o2.raw_data_fn_fg', (SELECT COUNT(*)::bigint FROM o2.raw_data_fn_fg)),
      ('o2.raw_mt_so_base', (SELECT COUNT(*)::bigint FROM o2.raw_mt_so_base)),
      ('o2.raw_mt_defect', (SELECT COUNT(*)::bigint FROM o2.raw_mt_defect)),
      ('o2.raw_mt_department', (SELECT COUNT(*)::bigint FROM o2.raw_mt_department)),
      ('o2.raw_mt_factory', (SELECT COUNT(*)::bigint FROM o2.raw_mt_factory)),
      ('o2.v_quality_defects_unified', (SELECT COUNT(*)::bigint FROM o2.v_quality_defects_unified))
    ) AS counts(table_name, row_count)
  `);

  return {
    rowCounts: result.rows.map((row) => ({
      tableName: row.table_name,
      rowCount: toNumber(row.row_count),
    })),
    meta: makeMeta(),
  };
};

export const getDebugDistinctValues = async () => {
  const [
    customers,
    factories,
    stages,
    lines,
    dateRange,
    monthYearRange,
    rawFactoryValues,
    customerSources,
  ] = await Promise.all([
    pool.query(`
      SELECT customer AS value, COUNT(*)::int AS row_count
      FROM o2.v_quality_defects_unified
      WHERE NULLIF(TRIM(customer), '') IS NOT NULL
      GROUP BY customer
      ORDER BY row_count DESC, customer
    `),
    pool.query(`
      SELECT factory AS value, COUNT(*)::int AS row_count
      FROM o2.v_quality_defects_unified
      WHERE NULLIF(TRIM(factory), '') IS NOT NULL
      GROUP BY factory
      ORDER BY row_count DESC, factory
    `),
    pool.query(`
      SELECT inspection_stage AS value, COUNT(*)::int AS row_count
      FROM o2.v_quality_defects_unified
      GROUP BY inspection_stage
      ORDER BY row_count DESC, inspection_stage
    `),
    pool.query(`
      SELECT fac_line AS value, COUNT(*)::int AS row_count
      FROM o2.v_quality_defects_unified
      WHERE NULLIF(TRIM(fac_line), '') IS NOT NULL
      GROUP BY fac_line
      ORDER BY row_count DESC, fac_line
      LIMIT 500
    `),
    pool.query(`
      SELECT MIN(inspection_date) AS min_date, MAX(inspection_date) AS max_date
      FROM o2.v_quality_defects_unified
      WHERE inspection_date IS NOT NULL
    `),
    pool.query(`
      SELECT
        MIN(date_trunc('month', inspection_date)::date) AS min_month,
        MAX(date_trunc('month', inspection_date)::date) AS max_month,
        COUNT(DISTINCT date_trunc('month', inspection_date)::date)::int AS month_count
      FROM o2.v_quality_defects_unified
      WHERE inspection_date IS NOT NULL
    `),
    pool.query(`
      SELECT *
      FROM (
        SELECT 'raw_mt_factory.factory' AS source, o2.factory_display_name(factory) AS value, COUNT(*)::int AS row_count FROM o2.raw_mt_factory GROUP BY source, value
        UNION ALL
        SELECT 'raw_data_fn_fg.factory', o2.factory_display_name(factory), COUNT(*)::int FROM o2.raw_data_fn_fg GROUP BY 1, 2
        UNION ALL
        SELECT 'raw_data_inline.id_bu', o2.factory_display_name(id_bu), COUNT(*)::int FROM o2.raw_data_inline GROUP BY 1, 2
        UNION ALL
        SELECT 'raw_data_endline.location_code', o2.factory_display_name(location_code), COUNT(*)::int FROM o2.raw_data_endline GROUP BY 1, 2
        UNION ALL
        SELECT 'raw_data_prefinal.location_code', o2.factory_display_name(location_code), COUNT(*)::int FROM o2.raw_data_prefinal GROUP BY 1, 2
        UNION ALL
        SELECT 'raw_data_final.factory', o2.factory_display_name(factory), COUNT(*)::int FROM o2.raw_data_final GROUP BY 1, 2
      ) values
      ORDER BY source, value
    `),
    pool.query(`
      SELECT inspection_stage, source_table AS customer_source, COUNT(*)::int AS row_count
      FROM o2.v_quality_defects_unified
      GROUP BY inspection_stage, source_table
      ORDER BY inspection_stage, source_table
    `),
  ]);

  const mapValueRows = (rows: Array<Record<string, unknown>>) =>
    rows.map((row) => ({
      value: row.value,
      rowCount: toNumber(row.row_count),
    }));

  return {
    customers: mapValueRows(customers.rows),
    factories: mapValueRows(factories.rows),
    inspectionStages: mapValueRows(stages.rows),
    facLines: mapValueRows(lines.rows),
    dateRange: {
      minDate: toIsoDate(dateRange.rows[0]?.min_date),
      maxDate: toIsoDate(dateRange.rows[0]?.max_date),
    },
    monthYearRange: {
      minMonth: toIsoDate(monthYearRange.rows[0]?.min_month),
      maxMonth: toIsoDate(monthYearRange.rows[0]?.max_month),
      monthCount: toNumber(monthYearRange.rows[0]?.month_count),
    },
    rawFactoryValues: rawFactoryValues.rows.map((row) => ({
      source: row.source,
      value: row.value,
      rowCount: toNumber(row.row_count),
    })),
    customerSources: customerSources.rows.map((row) => ({
      inspectionStage: row.inspection_stage,
      customerSource: row.customer_source,
      rowCount: toNumber(row.row_count),
    })),
    meta: makeMeta(),
  };
};

export const getDebugFilterTest = async (filters: QualityFilters) => {
  const filtered = buildFilteredCte(filters);
  const scanWhere = buildFnFgWhereClause(filters);

  const [summary, byStage, monthly, scan] = await Promise.all([
    pool.query(
      `
        ${filtered.sql}
        SELECT COUNT(*)::int AS total_rows
        FROM filtered
      `,
      filtered.values,
    ),
    pool.query(
      `
        ${filtered.sql}
        SELECT
          inspection_stage,
          COUNT(*)::int AS row_count,
          COALESCE(SUM(defect_qty), 0) AS defect_qty,
          COALESCE(SUM(inspected_qty), 0) AS inspected_qty,
          COALESCE(SUM(process_checks), 0) AS process_checks
        FROM filtered
        GROUP BY inspection_stage
        ORDER BY inspection_stage
      `,
      filtered.values,
    ),
    pool.query(
      `
        ${filtered.sql}
        SELECT
          date_trunc('month', inspection_date)::date AS month_start,
          to_char(date_trunc('month', inspection_date), 'Mon') AS month,
          inspection_stage,
          COUNT(*)::int AS row_count,
          COALESCE(SUM(defect_qty), 0) AS defect_qty,
          COALESCE(SUM(inspected_qty), 0) AS inspected_qty,
          COALESCE(SUM(process_checks), 0) AS process_checks
        FROM filtered
        WHERE inspection_date IS NOT NULL
        GROUP BY month_start, month, inspection_stage
        ORDER BY month_start, inspection_stage
      `,
      filtered.values,
    ),
    pool.query(
      `
        SELECT
          customer,
          factory_display AS factory,
          step,
          COUNT(*)::int AS row_count,
          COALESCE(SUM(qty), 0) AS qty,
          MIN(trx_date) AS min_date,
          MAX(trx_date) AS max_date
        FROM o2.v_scan_qty sq
        ${scanWhere.whereSql}
        GROUP BY customer, factory_display, step
        ORDER BY customer, factory, step
      `,
      scanWhere.values,
    ),
  ]);

  const totalRows = toNumber(summary.rows[0]?.total_rows);

  return {
    totalRows,
    rowsByInspectionStage: byStage.rows.map((row) => ({
      inspectionStage: row.inspection_stage,
      rowCount: toNumber(row.row_count),
      defectQty: toNumber(row.defect_qty),
      inspectedQty: toNumber(row.inspected_qty),
      processChecks: toNumber(row.process_checks),
    })),
    monthlyRowsByStage: monthly.rows.map((row) => ({
      monthStart: toIsoDate(row.month_start),
      month: String(row.month).trim(),
      inspectionStage: row.inspection_stage,
      rowCount: toNumber(row.row_count),
      defectQty: toNumber(row.defect_qty),
      inspectedQty: toNumber(row.inspected_qty),
      processChecks: toNumber(row.process_checks),
    })),
    scanQtyByStepFactoryCustomer: scan.rows.map((row) => ({
      customer: row.customer,
      factory: row.factory,
      step: row.step,
      rowCount: toNumber(row.row_count),
      qty: toNumber(row.qty),
      minDate: toIsoDate(row.min_date),
      maxDate: toIsoDate(row.max_date),
    })),
    meta: makeMeta(filters, totalRows),
  };
};

export const getRelationshipAudit = async () => {
  const auditResult = await pool.query(`
    WITH so_keys AS (
      SELECT DISTINCT o2.so_fact_key(so_no_doc, so_year, so_no) AS so_key
      FROM o2.raw_mt_so_base
      WHERE o2.so_fact_key(so_no_doc, so_year, so_no) IS NOT NULL
    ),
    defect_keys AS (
      SELECT DISTINCT o2.clean_text(defect_code) AS defect_key
      FROM o2.raw_mt_defect
      WHERE o2.clean_text(defect_code) IS NOT NULL
    ),
    bridge_so_keys AS (
      SELECT DISTINCT o2.clean_text(so_no_doc) AS so_key
      FROM o2.raw_bridge_so_line
      WHERE o2.clean_text(so_no_doc) IS NOT NULL
    ),
    dept_fac_lines AS (
      SELECT DISTINCT o2.clean_text(fac_line) AS fac_line_key
      FROM o2.raw_mt_department
      WHERE o2.clean_text(fac_line) IS NOT NULL
    ),
    dept_location_lines AS (
      SELECT DISTINCT
        o2.clean_text(location_code) AS location_key,
        o2.clean_text(line_name) AS line_name_key
      FROM o2.raw_mt_department
      WHERE o2.clean_text(location_code) IS NOT NULL
        AND o2.clean_text(line_name) IS NOT NULL
    ),
    view_summary AS (
      SELECT
        source_table,
        COUNT(*)::int AS view_rows,
        COUNT(*) FILTER (WHERE customer IS NOT NULL AND customer <> 'Unknown Customer')::int AS rows_with_customer_after_join,
        COUNT(*) FILTER (WHERE factory_display IS NOT NULL AND factory_display <> 'Unknown Factory')::int AS rows_with_factory_display,
        COUNT(*) FILTER (WHERE customer IS NULL OR customer = 'Unknown Customer')::int AS unknown_customer_count,
        COUNT(*) FILTER (WHERE factory_display IS NULL OR factory_display = 'Unknown Factory')::int AS unknown_factory_count,
        COUNT(*) FILTER (WHERE defect_desc_eng IS NULL OR defect_desc_eng = 'Unknown Defect')::int AS unknown_defect_count,
        COUNT(*) FILTER (WHERE fac_line IS NULL OR fac_line = 'Unknown Line')::int AS unknown_line_count
      FROM o2.v_quality_defects_unified
      GROUP BY source_table
    ),
    raw_audit AS (
      SELECT
        'raw_data_inline'::text AS source_table_name,
        COUNT(*)::int AS total_rows,
        COUNT(*) FILTER (WHERE o2.clean_text(i.so_no_doc) IS NOT NULL)::int AS rows_with_so_no_doc,
        COUNT(*) FILTER (WHERE so.so_key IS NOT NULL)::int AS rows_matched_to_mt_so_base,
        COUNT(*) FILTER (WHERE o2.clean_text(i.defect_code) IS NOT NULL)::int AS rows_with_defect_code,
        COUNT(*) FILTER (WHERE defect.defect_key IS NOT NULL)::int AS rows_matched_to_mt_defect,
        COUNT(*) FILTER (WHERE o2.clean_text(i.fac_line) IS NOT NULL)::int AS rows_with_fac_line,
        COUNT(*) FILTER (WHERE bridge.so_key IS NOT NULL OR dept_fac.fac_line_key IS NOT NULL OR dept_line.location_key IS NOT NULL)::int AS rows_matched_to_line
      FROM o2.raw_data_inline i
      LEFT JOIN so_keys so ON so.so_key = o2.clean_text(i.so_no_doc)
      LEFT JOIN defect_keys defect ON defect.defect_key = o2.clean_text(i.defect_code)
      LEFT JOIN bridge_so_keys bridge ON bridge.so_key = o2.clean_text(i.so_no_doc)
      LEFT JOIN dept_fac_lines dept_fac ON dept_fac.fac_line_key = o2.clean_text(i.fac_line)
      LEFT JOIN dept_location_lines dept_line
        ON dept_line.location_key = o2.clean_text(i.id_bu)
       AND dept_line.line_name_key = o2.clean_text(i.line_no)

      UNION ALL

      SELECT
        'raw_data_endline',
        COUNT(*)::int,
        COUNT(*) FILTER (WHERE o2.clean_text(e.so_no_doc) IS NOT NULL)::int,
        COUNT(*) FILTER (WHERE so.so_key IS NOT NULL)::int,
        COUNT(*) FILTER (WHERE o2.clean_text(e.defect_code) IS NOT NULL)::int,
        COUNT(*) FILTER (WHERE defect.defect_key IS NOT NULL)::int,
        COUNT(*) FILTER (WHERE o2.clean_text(e.fac_line) IS NOT NULL)::int,
        COUNT(*) FILTER (WHERE bridge.so_key IS NOT NULL OR dept_fac.fac_line_key IS NOT NULL OR dept_line.location_key IS NOT NULL)::int
      FROM o2.raw_data_endline e
      LEFT JOIN so_keys so ON so.so_key = o2.clean_text(e.so_no_doc)
      LEFT JOIN defect_keys defect ON defect.defect_key = o2.clean_text(e.defect_code)
      LEFT JOIN bridge_so_keys bridge ON bridge.so_key = o2.clean_text(e.so_no_doc)
      LEFT JOIN dept_fac_lines dept_fac ON dept_fac.fac_line_key = o2.clean_text(e.fac_line)
      LEFT JOIN dept_location_lines dept_line
        ON dept_line.location_key = o2.clean_text(e.location_code)
       AND dept_line.line_name_key = o2.clean_text(e.line_name)

      UNION ALL

      SELECT
        'raw_data_prefinal',
        COUNT(*)::int,
        COUNT(*) FILTER (WHERE o2.clean_text(p.so_no_doc) IS NOT NULL)::int,
        COUNT(*) FILTER (WHERE so.so_key IS NOT NULL)::int,
        COUNT(*) FILTER (WHERE o2.clean_text(p.defect_codes) IS NOT NULL)::int,
        COUNT(*) FILTER (WHERE defect.defect_key IS NOT NULL)::int,
        COUNT(*) FILTER (WHERE o2.clean_text(p.fac_line) IS NOT NULL)::int,
        COUNT(*) FILTER (WHERE bridge.so_key IS NOT NULL OR dept_fac.fac_line_key IS NOT NULL OR dept_line.location_key IS NOT NULL)::int
      FROM o2.raw_data_prefinal p
      LEFT JOIN so_keys so ON so.so_key = o2.clean_text(p.so_no_doc)
      LEFT JOIN defect_keys defect ON defect.defect_key = o2.clean_text(p.defect_codes)
      LEFT JOIN bridge_so_keys bridge ON bridge.so_key = o2.clean_text(p.so_no_doc)
      LEFT JOIN dept_fac_lines dept_fac ON dept_fac.fac_line_key = o2.clean_text(p.fac_line)
      LEFT JOIN dept_location_lines dept_line
        ON dept_line.location_key = o2.clean_text(p.location_code)
       AND dept_line.line_name_key = o2.clean_text(p.line_name)

      UNION ALL

      SELECT
        'raw_data_final',
        COUNT(*)::int,
        COUNT(*) FILTER (WHERE o2.clean_text(f.so_no_doc) IS NOT NULL)::int,
        COUNT(*) FILTER (WHERE so.so_key IS NOT NULL)::int,
        COUNT(*) FILTER (WHERE o2.clean_text(f.defect_code) IS NOT NULL)::int,
        COUNT(*) FILTER (WHERE defect.defect_key IS NOT NULL)::int,
        COUNT(*) FILTER (WHERE o2.clean_text(f.fac_line) IS NOT NULL)::int,
        COUNT(*) FILTER (WHERE dept_fac.fac_line_key IS NOT NULL)::int
      FROM o2.raw_data_final f
      LEFT JOIN so_keys so ON so.so_key = o2.clean_text(f.so_no_doc)
      LEFT JOIN defect_keys defect ON defect.defect_key = o2.clean_text(f.defect_code)
      LEFT JOIN dept_fac_lines dept_fac ON dept_fac.fac_line_key = o2.clean_text(f.fac_line)

      UNION ALL

      SELECT
        'raw_data_3party',
        COUNT(*)::int,
        COUNT(*) FILTER (WHERE o2.clean_text(t.so_no_doc) IS NOT NULL)::int,
        COUNT(*) FILTER (WHERE so.so_key IS NOT NULL)::int,
        COUNT(*) FILTER (WHERE o2.clean_text(t.code) IS NOT NULL)::int,
        COUNT(*) FILTER (WHERE defect.defect_key IS NOT NULL)::int,
        COUNT(*) FILTER (WHERE o2.clean_text(t.fac_line) IS NOT NULL)::int,
        COUNT(*) FILTER (WHERE bridge.so_key IS NOT NULL OR dept_fac.fac_line_key IS NOT NULL)::int
      FROM o2.raw_data_3party t
      LEFT JOIN so_keys so ON so.so_key = o2.clean_text(t.so_no_doc)
      LEFT JOIN defect_keys defect ON defect.defect_key = o2.clean_text(t.code)
      LEFT JOIN bridge_so_keys bridge ON bridge.so_key = o2.clean_text(t.so_no_doc)
      LEFT JOIN dept_fac_lines dept_fac ON dept_fac.fac_line_key = o2.clean_text(t.fac_line)
    )
    SELECT
      raw_audit.*,
      ROUND((rows_matched_to_mt_so_base::numeric / NULLIF(rows_with_so_no_doc, 0)) * 100, 2) AS so_match_percentage,
      ROUND((rows_matched_to_mt_defect::numeric / NULLIF(rows_with_defect_code, 0)) * 100, 2) AS defect_match_percentage,
      ROUND((rows_matched_to_line::numeric / NULLIF(total_rows, 0)) * 100, 2) AS line_match_percentage,
      COALESCE(view_summary.rows_with_customer_after_join, 0) AS rows_with_customer_after_join,
      COALESCE(view_summary.rows_with_factory_display, 0) AS rows_with_factory_display,
      COALESCE(view_summary.unknown_customer_count, 0) AS unknown_customer_count,
      COALESCE(view_summary.unknown_factory_count, 0) AS unknown_factory_count,
      COALESCE(view_summary.unknown_defect_count, 0) AS unknown_defect_count,
      COALESCE(view_summary.unknown_line_count, 0) AS unknown_line_count
    FROM raw_audit
    LEFT JOIN view_summary ON view_summary.source_table = raw_audit.source_table_name
    ORDER BY source_table_name
  `);

  const [customers, factorySourceCodes, factoryDisplays, stages, dateRange] = await Promise.all([
    pool.query(`
      SELECT customer, COUNT(*)::int AS row_count
      FROM o2.v_quality_defects_unified
      GROUP BY customer
      ORDER BY row_count DESC, customer
    `),
    pool.query(`
      SELECT factory_source_code, COUNT(*)::int AS row_count
      FROM o2.v_quality_defects_unified
      GROUP BY factory_source_code
      ORDER BY row_count DESC, factory_source_code
    `),
    pool.query(`
      SELECT factory_display, COUNT(*)::int AS row_count
      FROM o2.v_quality_defects_unified
      GROUP BY factory_display
      ORDER BY row_count DESC, factory_display
    `),
    pool.query(`
      SELECT inspection_stage, COUNT(*)::int AS row_count
      FROM o2.v_quality_defects_unified
      GROUP BY inspection_stage
      ORDER BY row_count DESC, inspection_stage
    `),
    pool.query(`
      SELECT MIN(inspection_date) AS min_date, MAX(inspection_date) AS max_date
      FROM o2.v_quality_defects_unified
      WHERE inspection_date IS NOT NULL
    `),
  ]);

  return {
    facts: auditResult.rows.map((row) => ({
      sourceTableName: row.source_table_name,
      totalRows: toNumber(row.total_rows),
      rowsWithSoNoDoc: toNumber(row.rows_with_so_no_doc),
      rowsMatchedToMtSoBase: toNumber(row.rows_matched_to_mt_so_base),
      soMatchPercentage: toNumber(row.so_match_percentage),
      rowsWithDefectCode: toNumber(row.rows_with_defect_code),
      rowsMatchedToMtDefect: toNumber(row.rows_matched_to_mt_defect),
      defectMatchPercentage: toNumber(row.defect_match_percentage),
      rowsWithFacLine: toNumber(row.rows_with_fac_line),
      rowsMatchedToLine: toNumber(row.rows_matched_to_line),
      lineMatchPercentage: toNumber(row.line_match_percentage),
      rowsWithCustomerAfterJoin: toNumber(row.rows_with_customer_after_join),
      rowsWithFactoryDisplay: toNumber(row.rows_with_factory_display),
      unknownCustomerCount: toNumber(row.unknown_customer_count),
      unknownFactoryCount: toNumber(row.unknown_factory_count),
      unknownDefectCount: toNumber(row.unknown_defect_count),
      unknownLineCount: toNumber(row.unknown_line_count),
    })),
    distinctCustomers: customers.rows.map((row) => ({
      customer: row.customer,
      rowCount: toNumber(row.row_count),
    })),
    distinctFactorySourceCodes: factorySourceCodes.rows.map((row) => ({
      factorySourceCode: row.factory_source_code,
      rowCount: toNumber(row.row_count),
    })),
    distinctFactoryDisplays: factoryDisplays.rows.map((row) => ({
      factoryDisplay: row.factory_display,
      rowCount: toNumber(row.row_count),
    })),
    distinctInspectionStages: stages.rows.map((row) => ({
      inspectionStage: row.inspection_stage,
      rowCount: toNumber(row.row_count),
    })),
    dateRange: {
      minDate: toIsoDate(dateRange.rows[0]?.min_date),
      maxDate: toIsoDate(dateRange.rows[0]?.max_date),
    },
    meta: makeMeta(),
  };
};

export const getPowerBiValidation = async (filters: QualityFilters) => {
  const filtered = buildFilteredCte(filters);

  const [kpis, monthly, weekly, defects, lines] = await Promise.all([
    pool.query(
      `
        ${filtered.sql},
        numerators AS (
          SELECT inspection_stage, COALESCE(SUM(defect_qty), 0) AS numerator
          FROM filtered
          GROUP BY inspection_stage
        ),
        denominators AS (
          SELECT inspection_stage, COALESCE(SUM(denominator), 0) AS denominator
          FROM (
            SELECT inspection_stage, denominator_key, MAX(${denominatorExpression}) AS denominator
            FROM filtered
            GROUP BY inspection_stage, denominator_key
          ) denominator_rows
          GROUP BY inspection_stage
        )
        SELECT
          COALESCE(numerators.inspection_stage, denominators.inspection_stage) AS inspection_stage,
          COALESCE(numerators.numerator, 0) AS numerator,
          COALESCE(denominators.denominator, 0) AS denominator,
          CASE
            WHEN COALESCE(denominators.denominator, 0) = 0 THEN 0
            ELSE ROUND((COALESCE(numerators.numerator, 0) / denominators.denominator) * 100, 2)
          END AS rate
        FROM numerators
        FULL OUTER JOIN denominators USING (inspection_stage)
        ORDER BY
          CASE COALESCE(numerators.inspection_stage, denominators.inspection_stage)
            WHEN 'Inline' THEN 1
            WHEN 'Endline' THEN 2
            WHEN 'Pre Final' THEN 3
            WHEN 'Final' THEN 4
            WHEN 'Third Party' THEN 5
            ELSE 99
          END
      `,
      filtered.values,
    ),
    pool.query(
      `
        ${filtered.sql},
        numerators AS (
          SELECT date_trunc('month', inspection_date)::date AS period_start, inspection_stage, COALESCE(SUM(defect_qty), 0) AS numerator
          FROM filtered
          WHERE inspection_date IS NOT NULL
          GROUP BY period_start, inspection_stage
        ),
        denominators AS (
          SELECT period_start, inspection_stage, COALESCE(SUM(denominator), 0) AS denominator
          FROM (
            SELECT
              date_trunc('month', inspection_date)::date AS period_start,
              inspection_stage,
              denominator_key,
              MAX(${denominatorExpression}) AS denominator
            FROM filtered
            WHERE inspection_date IS NOT NULL
            GROUP BY period_start, inspection_stage, denominator_key
          ) denominator_rows
          GROUP BY period_start, inspection_stage
        )
        SELECT
          to_char(COALESCE(numerators.period_start, denominators.period_start), 'YYYY-MM-DD') AS period_start,
          to_char(COALESCE(numerators.period_start, denominators.period_start), 'Mon') AS month,
          COALESCE(numerators.inspection_stage, denominators.inspection_stage) AS inspection_stage,
          COALESCE(numerators.numerator, 0) AS numerator,
          COALESCE(denominators.denominator, 0) AS denominator,
          CASE
            WHEN COALESCE(denominators.denominator, 0) = 0 THEN 0
            ELSE ROUND((COALESCE(numerators.numerator, 0) / denominators.denominator) * 100, 2)
          END AS rate
        FROM numerators
        FULL OUTER JOIN denominators
          ON denominators.period_start = numerators.period_start
         AND denominators.inspection_stage = numerators.inspection_stage
        ORDER BY period_start, inspection_stage
      `,
      filtered.values,
    ),
    pool.query(
      `
        ${filtered.sql},
        numerators AS (
          SELECT date_trunc('week', inspection_date)::date AS period_start, inspection_stage, COALESCE(SUM(defect_qty), 0) AS numerator
          FROM filtered
          WHERE inspection_date IS NOT NULL
          GROUP BY period_start, inspection_stage
        ),
        denominators AS (
          SELECT period_start, inspection_stage, COALESCE(SUM(denominator), 0) AS denominator
          FROM (
            SELECT
              date_trunc('week', inspection_date)::date AS period_start,
              inspection_stage,
              denominator_key,
              MAX(${denominatorExpression}) AS denominator
            FROM filtered
            WHERE inspection_date IS NOT NULL
            GROUP BY period_start, inspection_stage, denominator_key
          ) denominator_rows
          GROUP BY period_start, inspection_stage
        )
        SELECT
          to_char(COALESCE(numerators.period_start, denominators.period_start), 'YYYY-MM-DD') AS period_start,
          to_char(COALESCE(numerators.period_start, denominators.period_start), 'IYYY-"W"IW') AS iso_week,
          COALESCE(numerators.inspection_stage, denominators.inspection_stage) AS inspection_stage,
          COALESCE(numerators.numerator, 0) AS numerator,
          COALESCE(denominators.denominator, 0) AS denominator,
          CASE
            WHEN COALESCE(denominators.denominator, 0) = 0 THEN 0
            ELSE ROUND((COALESCE(numerators.numerator, 0) / denominators.denominator) * 100, 2)
          END AS rate
        FROM numerators
        FULL OUTER JOIN denominators
          ON denominators.period_start = numerators.period_start
         AND denominators.inspection_stage = numerators.inspection_stage
        ORDER BY period_start, inspection_stage
      `,
      filtered.values,
    ),
    pool.query(
      `
        ${filtered.sql}
        SELECT
          COALESCE(NULLIF(defect_desc_eng, ''), 'Unmapped') AS defect_description,
          inspection_stage,
          COALESCE(SUM(defect_qty), 0) AS numerator
        FROM filtered
        GROUP BY defect_description, inspection_stage
        ORDER BY numerator DESC, defect_description
        LIMIT 100
      `,
      filtered.values,
    ),
    pool.query(
      `
        ${filtered.sql},
        numerators AS (
          SELECT COALESCE(NULLIF(fac_line, ''), 'Unassigned') AS line, inspection_stage, COALESCE(SUM(defect_qty), 0) AS numerator
          FROM filtered
          GROUP BY line, inspection_stage
        ),
        denominators AS (
          SELECT line, inspection_stage, COALESCE(SUM(denominator), 0) AS denominator
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
          COALESCE(numerators.line, denominators.line) AS line,
          COALESCE(numerators.inspection_stage, denominators.inspection_stage) AS inspection_stage,
          COALESCE(numerators.numerator, 0) AS numerator,
          COALESCE(denominators.denominator, 0) AS denominator,
          CASE
            WHEN COALESCE(denominators.denominator, 0) = 0 THEN 0
            ELSE ROUND((COALESCE(numerators.numerator, 0) / denominators.denominator) * 100, 2)
          END AS rate
        FROM numerators
        FULL OUTER JOIN denominators
          ON denominators.line = numerators.line
         AND denominators.inspection_stage = numerators.inspection_stage
        ORDER BY line, inspection_stage
        LIMIT 250
      `,
      filtered.values,
    ),
  ]);

  return {
    kpis: kpis.rows.map((row) => ({
      inspectionStage: row.inspection_stage,
      numerator: toNumber(row.numerator),
      denominator: toNumber(row.denominator),
      rate: toNumber(row.rate),
    })),
    monthly: monthly.rows.map((row) => ({
      periodStart: row.period_start,
      month: String(row.month).trim(),
      inspectionStage: row.inspection_stage,
      numerator: toNumber(row.numerator),
      denominator: toNumber(row.denominator),
      rate: toNumber(row.rate),
    })),
    weekly: weekly.rows.map((row) => ({
      periodStart: row.period_start,
      isoWeek: row.iso_week,
      inspectionStage: row.inspection_stage,
      numerator: toNumber(row.numerator),
      denominator: toNumber(row.denominator),
      rate: toNumber(row.rate),
    })),
    defectCategoryTotals: defects.rows.map((row) => ({
      defectDescription: row.defect_description,
      inspectionStage: row.inspection_stage,
      numerator: toNumber(row.numerator),
    })),
    lineTotals: lines.rows.map((row) => ({
      line: row.line,
      inspectionStage: row.inspection_stage,
      numerator: toNumber(row.numerator),
      denominator: toNumber(row.denominator),
      rate: toNumber(row.rate),
    })),
    meta: makeMeta(filters),
  };
};
