import dotenv from "dotenv";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import type pg from "pg";
import { closePool, pool } from "../db/pool.js";
import { refreshMaterializedViews } from "../db/refreshMaterializedViews.js";
import {
  importWorkbookToSchema,
  inspectWorkbookStructure,
  quoteIdent,
  quoteTableName,
  readWorkbook,
  recreateStagingTables,
  type ImportSummary,
} from "../import/importExcel.js";
import { sheetMappings } from "../import/sheetMappings.js";

dotenv.config();

const LIVE_SCHEMA = "o2";
const STAGING_SCHEMA = "o2_staging";
const BACKUP_SCHEMA = "o2_backup";
const EXPECTED_START_DATE = process.env.EXPECTED_DATA_START_DATE ?? "2026-01-01";
const EXPECTED_END_DATE = process.env.EXPECTED_DATA_END_DATE ?? "2026-06-30";
const LARGE_CHANGE_PERCENT = Number(process.env.DATA_REFRESH_WARNING_PERCENT ?? 50);

type CliOptions = {
  filePath: string;
  dryRun: boolean;
  exportStatic: boolean;
};

type TableCount = {
  table: string;
  liveRows: number;
  stagingRows: number;
  differencePercent: number | null;
};

type DateCheck = {
  table: string;
  minDate: string | null;
  maxDate: string | null;
  nullDates: number;
};

type KpiCheck = {
  metric: string;
  liveValue: number;
  stagingValue: number;
  differencePercent: number | null;
};

type ValidationReport = {
  passed: boolean;
  errors: string[];
  warnings: string[];
  tableCounts: TableCount[];
  dateChecks: DateCheck[];
  customers: Array<{ customer: string; rowCount: number }>;
  factories: Array<{ factory: string; rowCount: number }>;
  kpiChecks: KpiCheck[];
};

type FactSpec = {
  stage: string;
  table: string;
  dateColumn: string;
  defectExpression: string;
  denominatorExpression: string;
  denominatorKey: string;
};

const factSpecs: FactSpec[] = [
  {
    stage: "Inline",
    table: "raw_data_inline",
    dateColumn: "job_date",
    defectExpression: "COALESCE(cnt_failed, 0)",
    denominatorExpression: "COALESCE(total_inspect, 0)",
    denominatorKey: "concat_ws('|', NULLIF(btrim(so_no_doc), ''), COALESCE(NULLIF(btrim(fac_line), ''), NULLIF(btrim(line_no), '')))",
  },
  {
    stage: "Endline",
    table: "raw_data_endline",
    dateColumn: "job_date",
    defectExpression: "COALESCE(defect_point, 0)",
    denominatorExpression: "COALESCE(total_inspect, 0)",
    denominatorKey: "concat_ws('|', job_date::text, NULLIF(btrim(so_no_doc), ''), COALESCE(NULLIF(btrim(fac_line), ''), NULLIF(btrim(line_name), '')))",
  },
  {
    stage: "Pre Final",
    table: "raw_data_prefinal",
    dateColumn: "job_date",
    defectExpression: "COALESCE(total_defects, 0)",
    denominatorExpression: "COALESCE(total_inspect, 0)",
    denominatorKey: "concat_ws('|', job_date::text, NULLIF(btrim(so_no_doc), ''), COALESCE(NULLIF(btrim(fac_line), ''), NULLIF(btrim(line_name), '')))",
  },
  {
    stage: "Final",
    table: "raw_data_final",
    dateColumn: "date",
    defectExpression: "COALESCE(defect_qty, total_defect_found, 0)",
    denominatorExpression: "COALESCE(total_garment_inspected, 0)",
    denominatorKey: "concat_ws('|', \"date\"::text, NULLIF(btrim(so_no_doc), ''), COALESCE(NULLIF(btrim(fac_line), ''), NULLIF(btrim(sewing_line_no), '')))",
  },
  {
    stage: "Third Party",
    table: "raw_data_3party",
    dateColumn: "date",
    defectExpression: "COALESCE(defect_qty, 0)",
    denominatorExpression: "COALESCE(inspect_qty, total, 0)",
    denominatorKey: "concat_ws('|', \"date\"::text, NULLIF(btrim(so_no_doc), ''), NULLIF(btrim(color), ''), NULLIF(btrim(audit), ''), NULLIF(btrim(fac_line), ''))",
  },
];

const keyTables = new Set([
  "raw_data_inline",
  "raw_data_endline",
  "raw_data_prefinal",
  "raw_data_final",
  "raw_data_3party",
  "raw_data_fn_fg",
  "raw_mt_so_base",
]);

const expectedCustomers = ["Travis Mathew", "lululemon", "Fanatics"];

const tableBaseName = (tableName: string) => {
  const baseName = tableName.split(".").at(-1);
  if (!baseName) throw new Error(`Invalid table name: ${tableName}`);
  return baseName;
};

const schemaTable = (schema: string, table: string) => `${quoteIdent(schema)}.${quoteIdent(table)}`;

const numberValue = (value: unknown) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const percentDifference = (liveValue: number, stagingValue: number) => {
  if (liveValue === 0) return stagingValue === 0 ? 0 : null;
  return ((stagingValue - liveValue) / Math.abs(liveValue)) * 100;
};

const formatPercent = (value: number | null) => value === null ? "new/non-zero" : `${value.toFixed(1)}%`;

const timestampId = () => new Date().toISOString().slice(0, 19).replace(/\D/g, "");

const parseCliOptions = (): CliOptions => {
  const args = process.argv.slice(2);
  const fileIndex = args.indexOf("--file");
  const fileArg = fileIndex >= 0 ? args[fileIndex + 1] : undefined;
  if (!fileArg || fileArg.startsWith("--")) {
    throw new Error('Missing required --file argument. Example: npm run refresh:data -- --file "../data/new_file.xlsx" --dry-run');
  }

  const filePath = path.resolve(process.cwd(), fileArg);
  if (!existsSync(filePath)) throw new Error(`Excel file not found: ${filePath}`);
  if (!filePath.toLowerCase().endsWith(".xlsx")) throw new Error(`Expected an .xlsx file: ${filePath}`);

  return {
    filePath,
    dryRun: args.includes("--dry-run"),
    exportStatic: args.includes("--export-static"),
  };
};

const assertLiveTablesExist = async (client: pg.PoolClient) => {
  const missing: string[] = [];
  for (const mapping of sheetMappings) {
    const result = await client.query<{ table_name: string | null }>("SELECT to_regclass($1) AS table_name", [mapping.tableName]);
    if (!result.rows[0]?.table_name) missing.push(mapping.tableName);
  }
  if (missing.length > 0) throw new Error(`Missing live raw table(s). Run npm run migrate first: ${missing.join(", ")}`);
};

const tryPgDump = (runId: string) => {
  const version = spawnSync("pg_dump", ["--version"], { stdio: "ignore", shell: false });
  if (version.status !== 0) {
    console.warn("pg_dump is not available; continuing with mandatory in-database backup tables.");
    return null;
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.warn("DATABASE_URL is not set; pg_dump skipped. In-database backup tables will still be created.");
    return null;
  }

  const backupDir = path.resolve(process.cwd(), "backups");
  mkdirSync(backupDir, { recursive: true });
  const dumpPath = path.join(backupDir, `o2_before_refresh_${runId}.dump`);
  const result = spawnSync(
    "pg_dump",
    ["--format=custom", `--file=${dumpPath}`, `--schema=${LIVE_SCHEMA}`],
    {
      env: { ...process.env, PGDATABASE: databaseUrl },
      stdio: "inherit",
      shell: false,
    },
  );

  if (result.status !== 0) {
    console.warn("pg_dump failed; the refresh will continue only because in-database backup tables are also created.");
    return null;
  }

  console.info(`Database dump created: ${dumpPath}`);
  return dumpPath;
};

const createSqlBackups = async (
  client: pg.PoolClient,
  runId: string,
  sourceFile: string,
  dumpPath: string | null,
) => {
  const backupTables: Record<string, string> = {};
  await client.query("BEGIN");
  try {
    await client.query(`CREATE SCHEMA IF NOT EXISTS ${quoteIdent(BACKUP_SCHEMA)}`);
    await client.query(`
      CREATE TABLE IF NOT EXISTS ${schemaTable(BACKUP_SCHEMA, "refresh_runs")} (
        run_id text PRIMARY KEY,
        created_at timestamptz NOT NULL DEFAULT now(),
        source_file text NOT NULL,
        dump_path text,
        status text NOT NULL,
        validation_report jsonb,
        completed_at timestamptz
      )
    `);
    await client.query(
      `INSERT INTO ${schemaTable(BACKUP_SCHEMA, "refresh_runs")} (run_id, source_file, dump_path, status) VALUES ($1, $2, $3, 'backed_up')`,
      [runId, sourceFile, dumpPath],
    );

    for (const mapping of sheetMappings) {
      const liveTable = tableBaseName(mapping.tableName);
      const backupTable = `${liveTable}_${runId}`;
      await client.query(`CREATE TABLE ${schemaTable(BACKUP_SCHEMA, backupTable)} AS TABLE ${quoteTableName(mapping.tableName)}`);
      backupTables[liveTable] = backupTable;
      console.info(`Backed up ${mapping.tableName} -> ${BACKUP_SCHEMA}.${backupTable}`);
    }
    await client.query("COMMIT");
    return backupTables;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
};

const updateRunStatus = async (
  client: pg.PoolClient,
  runId: string,
  status: string,
  report?: ValidationReport,
) => {
  await client.query(
    `UPDATE ${schemaTable(BACKUP_SCHEMA, "refresh_runs")}
     SET status = $2, validation_report = COALESCE($3::jsonb, validation_report),
         completed_at = CASE WHEN $2 IN ('completed', 'validation_failed', 'failed') THEN now() ELSE completed_at END
     WHERE run_id = $1`,
    [runId, status, report ? JSON.stringify(report) : null],
  );
};

const importToStaging = async (client: pg.PoolClient, workbook: ReturnType<typeof readWorkbook>) => {
  await client.query("BEGIN");
  try {
    await recreateStagingTables(client, STAGING_SCHEMA);
    const summaries = await importWorkbookToSchema(client, workbook, STAGING_SCHEMA);
    await client.query("COMMIT");
    return summaries;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
};

const getRowCounts = async (client: pg.PoolClient): Promise<TableCount[]> => {
  const counts: TableCount[] = [];
  for (const mapping of sheetMappings) {
    const table = tableBaseName(mapping.tableName);
    const live = await client.query<{ row_count: number }>(
      `SELECT COUNT(*)::int AS row_count FROM ${schemaTable(LIVE_SCHEMA, table)}`,
    );
    const staging = await client.query<{ row_count: number }>(
      `SELECT COUNT(*)::int AS row_count FROM ${schemaTable(STAGING_SCHEMA, table)}`,
    );
    const liveRows = numberValue(live.rows[0]?.row_count);
    const stagingRows = numberValue(staging.rows[0]?.row_count);
    counts.push({ table, liveRows, stagingRows, differencePercent: percentDifference(liveRows, stagingRows) });
  }
  return counts;
};

const getDateChecks = async (client: pg.PoolClient): Promise<DateCheck[]> => {
  const checks: DateCheck[] = [];
  for (const spec of factSpecs) {
    const dateColumn = quoteIdent(spec.dateColumn);
    const result = await client.query<{ min_date: string | null; max_date: string | null; null_dates: number }>(`
      SELECT MIN(${dateColumn})::text AS min_date, MAX(${dateColumn})::text AS max_date,
             COUNT(*) FILTER (WHERE ${dateColumn} IS NULL)::int AS null_dates
      FROM ${schemaTable(STAGING_SCHEMA, spec.table)}
    `);
    checks.push({
      table: spec.table,
      minDate: result.rows[0]?.min_date ?? null,
      maxDate: result.rows[0]?.max_date ?? null,
      nullDates: numberValue(result.rows[0]?.null_dates),
    });
  }
  return checks;
};

const getCustomers = async (client: pg.PoolClient) => {
  const result = await client.query<{ customer: string; row_count: number }>(`
    WITH customer_values AS (
      SELECT NULLIF(btrim(cust_name), '') AS customer FROM ${schemaTable(STAGING_SCHEMA, "raw_mt_so_base")}
      UNION ALL SELECT NULLIF(btrim(brand), '') FROM ${schemaTable(STAGING_SCHEMA, "raw_mt_so")}
      UNION ALL SELECT NULLIF(btrim(cust_name), '') FROM ${schemaTable(STAGING_SCHEMA, "raw_data_fn_fg")}
      UNION ALL SELECT NULLIF(btrim(customer_brand), '') FROM ${schemaTable(STAGING_SCHEMA, "raw_data_final")}
    )
    SELECT customer, COUNT(*)::int AS row_count
    FROM customer_values WHERE customer IS NOT NULL
    GROUP BY customer ORDER BY row_count DESC, customer
  `);
  return result.rows.map((row) => ({ customer: row.customer, rowCount: numberValue(row.row_count) }));
};

const getFactories = async (client: pg.PoolClient) => {
  const result = await client.query<{ factory: string; row_count: number }>(`
    WITH factory_values AS (
      SELECT NULLIF(btrim(factory), '') AS factory FROM ${schemaTable(STAGING_SCHEMA, "raw_mt_factory")}
      UNION ALL SELECT NULLIF(btrim(factoryg), '') FROM ${schemaTable(STAGING_SCHEMA, "raw_mt_factory")}
      UNION ALL SELECT NULLIF(btrim(id_bu), '') FROM ${schemaTable(STAGING_SCHEMA, "raw_data_inline")}
      UNION ALL SELECT NULLIF(btrim(location_code), '') FROM ${schemaTable(STAGING_SCHEMA, "raw_data_endline")}
      UNION ALL SELECT NULLIF(btrim(location_code), '') FROM ${schemaTable(STAGING_SCHEMA, "raw_data_prefinal")}
      UNION ALL SELECT NULLIF(btrim(factory), '') FROM ${schemaTable(STAGING_SCHEMA, "raw_data_final")}
      UNION ALL SELECT NULLIF(btrim(factory), '') FROM ${schemaTable(STAGING_SCHEMA, "raw_data_fn_fg")}
    )
    SELECT factory, COUNT(*)::int AS row_count
    FROM factory_values WHERE factory IS NOT NULL
    GROUP BY factory ORDER BY row_count DESC, factory
  `);
  return result.rows.map((row) => ({ factory: row.factory, rowCount: numberValue(row.row_count) }));
};

const metricValue = async (
  client: pg.PoolClient,
  schema: string,
  spec: FactSpec,
  expression: string,
) => {
  const result = await client.query<{ value: string | number }>(
    `SELECT COALESCE(SUM(${expression}), 0) AS value FROM ${schemaTable(schema, spec.table)}`,
  );
  return numberValue(result.rows[0]?.value);
};

const denominatorValue = async (client: pg.PoolClient, schema: string, spec: FactSpec) => {
  const result = await client.query<{ value: string | number }>(`
    SELECT COALESCE(SUM(denominator), 0) AS value
    FROM (
      SELECT ${spec.denominatorKey} AS denominator_key, MAX(${spec.denominatorExpression}) AS denominator
      FROM ${schemaTable(schema, spec.table)}
      GROUP BY denominator_key
    ) denominator_rows
  `);
  return numberValue(result.rows[0]?.value);
};

const getKpiChecks = async (client: pg.PoolClient): Promise<KpiCheck[]> => {
  const checks: KpiCheck[] = [];
  for (const spec of factSpecs) {
    const liveDefects = await metricValue(client, LIVE_SCHEMA, spec, spec.defectExpression);
    const stagingDefects = await metricValue(client, STAGING_SCHEMA, spec, spec.defectExpression);
    const liveDenominator = await denominatorValue(client, LIVE_SCHEMA, spec);
    const stagingDenominator = await denominatorValue(client, STAGING_SCHEMA, spec);
    checks.push({
      metric: `${spec.stage} defect qty`,
      liveValue: liveDefects,
      stagingValue: stagingDefects,
      differencePercent: percentDifference(liveDefects, stagingDefects),
    });
    checks.push({
      metric: `${spec.stage} denominator`,
      liveValue: liveDenominator,
      stagingValue: stagingDenominator,
      differencePercent: percentDifference(liveDenominator, stagingDenominator),
    });
  }
  return checks;
};

const validateStaging = async (client: pg.PoolClient): Promise<ValidationReport> => {
  const errors: string[] = [];
  const warnings: string[] = [];
  const tableCounts = await getRowCounts(client);
  const dateChecks = await getDateChecks(client);
  const customers = await getCustomers(client);
  const factories = await getFactories(client);
  const kpiChecks = await getKpiChecks(client);

  for (const count of tableCounts) {
    if (keyTables.has(count.table) && count.stagingRows === 0) errors.push(`Key staging table ${count.table} has 0 rows.`);
    if (count.differencePercent !== null && Math.abs(count.differencePercent) > LARGE_CHANGE_PERCENT) {
      warnings.push(`${count.table} row count changed by ${formatPercent(count.differencePercent)}.`);
    }
  }

  for (const check of dateChecks) {
    if (!check.minDate || !check.maxDate) {
      errors.push(`${check.table} has no valid inspection dates.`);
      continue;
    }
    if (check.maxDate < EXPECTED_START_DATE || check.minDate > EXPECTED_END_DATE) {
      errors.push(`${check.table} date range ${check.minDate}..${check.maxDate} does not overlap expected range ${EXPECTED_START_DATE}..${EXPECTED_END_DATE}.`);
    } else if (check.minDate < EXPECTED_START_DATE || check.maxDate > EXPECTED_END_DATE) {
      warnings.push(`${check.table} includes dates outside expected range ${EXPECTED_START_DATE}..${EXPECTED_END_DATE}: ${check.minDate}..${check.maxDate}.`);
    }
    if (check.nullDates > 0) warnings.push(`${check.table} has ${check.nullDates} row(s) with a null date.`);
  }

  const normalizedCustomers = new Set(customers.map((item) => item.customer.toLowerCase()));
  for (const expected of expectedCustomers) {
    if (!normalizedCustomers.has(expected.toLowerCase())) warnings.push(`Expected dashboard customer "${expected}" was not found in staging customer sources.`);
  }
  if (!factories.some((item) => item.factory.trim().toLowerCase() === "g3")) {
    warnings.push('Expected factory "G3" was not found in staging factory sources.');
  }

  for (const check of kpiChecks) {
    if (check.stagingValue === 0) warnings.push(`${check.metric} is 0 in staging.`);
    if (check.differencePercent !== null && Math.abs(check.differencePercent) > LARGE_CHANGE_PERCENT) {
      warnings.push(`${check.metric} changed by ${formatPercent(check.differencePercent)}.`);
    }
  }

  return { passed: errors.length === 0, errors, warnings, tableCounts, dateChecks, customers, factories, kpiChecks };
};

const printValidationReport = (report: ValidationReport) => {
  console.info("\nRow count comparison:");
  console.table(report.tableCounts.map((row) => ({ ...row, differencePercent: formatPercent(row.differencePercent) })));
  console.info("Date validation:");
  console.table(report.dateChecks);
  console.info("Customer validation:");
  const expectedCustomerNames = new Set(expectedCustomers.map((value) => value.toLowerCase()));
  console.table(report.customers.filter((item, index) => index < 20 || expectedCustomerNames.has(item.customer.toLowerCase())));
  console.info("Factory validation:");
  console.table(report.factories);
  console.info("KPI sanity comparison:");
  console.table(report.kpiChecks.map((row) => ({ ...row, differencePercent: formatPercent(row.differencePercent) })));
  report.warnings.forEach((warning) => console.warn(`WARNING: ${warning}`));
  report.errors.forEach((error) => console.error(`ERROR: ${error}`));
  console.info(`Validation result: ${report.passed ? "PASS" : "FAIL"}`);
};

const promoteStaging = async (client: pg.PoolClient) => {
  await client.query("BEGIN");
  try {
    await client.query("SET LOCAL lock_timeout = '15s'");
    const liveTables = sheetMappings.map((mapping) => quoteTableName(mapping.tableName));
    await client.query(`TRUNCATE TABLE ${liveTables.join(", ")} RESTART IDENTITY`);

    for (const mapping of sheetMappings) {
      const table = tableBaseName(mapping.tableName);
      const columns = [...mapping.columns.map((column) => column.column), "imported_at"];
      const quotedColumns = columns.map(quoteIdent).join(", ");
      await client.query(`
        INSERT INTO ${schemaTable(LIVE_SCHEMA, table)} (${quotedColumns})
        SELECT ${quotedColumns} FROM ${schemaTable(STAGING_SCHEMA, table)}
      `);
      const countCheck = await client.query<{ live_count: number; staging_count: number }>(`
        SELECT
          (SELECT COUNT(*)::int FROM ${schemaTable(LIVE_SCHEMA, table)}) AS live_count,
          (SELECT COUNT(*)::int FROM ${schemaTable(STAGING_SCHEMA, table)}) AS staging_count
      `);
      if (countCheck.rows[0]?.live_count !== countCheck.rows[0]?.staging_count) {
        throw new Error(`Promotion count mismatch for ${table}.`);
      }
    }

    await refreshMaterializedViews(client);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
};

const runStaticExport = () => {
  const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
  const result = spawnSync(npmCommand, ["run", "export:static"], { cwd: process.cwd(), stdio: "inherit", shell: false });
  if (result.status !== 0) throw new Error("Database refresh succeeded, but static JSON export failed.");
};

const run = async () => {
  const options = parseCliOptions();
  console.info(`Reading workbook: ${options.filePath}`);
  console.info(`Mode: ${options.dryRun ? "DRY RUN (live tables will not change)" : "LIVE SAFE REFRESH"}`);

  const workbook = readWorkbook(options.filePath);
  const structure = inspectWorkbookStructure(workbook);
  console.table(structure.sheets);
  if (structure.errors.length > 0) {
    structure.errors.forEach((error) => console.error(`ERROR: ${error}`));
    throw new Error("Workbook structure validation failed. No database tables were changed.");
  }
  console.info("Workbook structure validation: PASS");

  const client = await pool.connect();
  const runId = timestampId();
  let backupCreated = false;
  try {
    await assertLiveTablesExist(client);

    if (!options.dryRun) {
      const dumpPath = tryPgDump(runId);
      await createSqlBackups(client, runId, options.filePath, dumpPath);
      backupCreated = true;
    } else {
      console.info("Dry run: backup skipped because live tables will not be modified.");
    }

    const summaries: ImportSummary[] = await importToStaging(client, workbook);
    console.info(`Imported ${summaries.reduce((sum, item) => sum + item.importedRows, 0)} staging rows across ${summaries.length} sheets.`);

    const report = await validateStaging(client);
    printValidationReport(report);
    if (backupCreated) await updateRunStatus(client, runId, report.passed ? "validated" : "validation_failed", report);
    if (!report.passed) throw new Error("Staging validation failed. Live raw tables remain unchanged.");

    if (options.dryRun) {
      console.info("Dry run completed. Staging data was validated; live raw tables were not changed.");
      return { exportStatic: false };
    }

    await promoteStaging(client);
    await updateRunStatus(client, runId, "completed", report);
    console.info(`Safe refresh completed. Backup run ID: ${runId}`);
    console.info("Next step: npm run export:static");
    return { exportStatic: options.exportStatic };
  } catch (error) {
    if (backupCreated) {
      await updateRunStatus(client, runId, "failed").catch(() => undefined);
    }
    throw error;
  } finally {
    client.release();
  }
};

run()
  .then(async ({ exportStatic }) => {
    await closePool();
    if (exportStatic) runStaticExport();
  })
  .catch(async (error) => {
    console.error("Safe data refresh failed:");
    console.error(error instanceof Error ? error.message : error);
    await closePool().catch(() => undefined);
    process.exitCode = 1;
  });
