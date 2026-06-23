import type pg from "pg";
import xlsx from "xlsx";
import { toPostgresDateString } from "../utils/excelDate.js";
import { normalizeHeader, normalizeTextValue, toNumberOrNull } from "../utils/normalize.js";
import { type ColumnType, type SheetMapping, sheetMappings } from "./sheetMappings.js";

const batchSize = 1000;

export type ImportSummary = {
  sheetName: string;
  tableName: string;
  importedRows: number;
  skippedRows: number;
};

export type WorkbookStructureReport = {
  sheets: Array<{ sheetName: string; dataRows: number }>;
  errors: string[];
};

export const quoteIdent = (identifier: string) => `"${identifier.replace(/"/g, '""')}"`;

export const quoteTableName = (tableName: string) => tableName.split(".").map(quoteIdent).join(".");

const targetTableName = (mapping: SheetMapping, schema: string) => {
  const table = mapping.tableName.split(".").at(-1);
  if (!table) throw new Error(`Invalid mapped table name: ${mapping.tableName}`);
  return `${schema}.${table}`;
};

const coerceValue = (value: unknown, type: ColumnType) => {
  if (type === "date") return toPostgresDateString(value);
  if (type === "numeric") return toNumberOrNull(value);
  return normalizeTextValue(value);
};

const sourceCandidatesFor = (column: string, sourceAliases: string[] = []) =>
  [column, ...sourceAliases].map((value) => normalizeHeader(value));

const getHeaderIndex = (headers: unknown[]) => {
  const index = new Map<string, number>();
  headers.forEach((header, position) => {
    const normalized = normalizeHeader(header);
    if (normalized && !index.has(normalized)) index.set(normalized, position);
  });
  return index;
};

const worksheetHeaders = (worksheet: xlsx.WorkSheet): unknown[] => {
  const reference = worksheet["!ref"];
  if (!reference) return [];
  const range = xlsx.utils.decode_range(reference);
  const headers: unknown[] = [];
  for (let column = range.s.c; column <= range.e.c; column += 1) {
    headers.push(worksheet[xlsx.utils.encode_cell({ r: range.s.r, c: column })]?.v ?? null);
  }
  return headers;
};

const worksheetDataRowCount = (worksheet: xlsx.WorkSheet) => {
  const reference = worksheet["!ref"];
  if (!reference) return 0;
  const range = xlsx.utils.decode_range(reference);
  return Math.max(0, range.e.r - range.s.r);
};

const missingColumns = (mapping: SheetMapping, headers: unknown[]) => {
  const headerIndex = getHeaderIndex(headers);
  return mapping.columns
    .filter((column) => !sourceCandidatesFor(column.column, column.sourceAliases).some((source) => headerIndex.has(source)))
    .map((column) => column.column);
};

export const inspectWorkbookStructure = (workbook: xlsx.WorkBook): WorkbookStructureReport => {
  const sheets: WorkbookStructureReport["sheets"] = [];
  const errors: string[] = [];

  for (const mapping of sheetMappings) {
    const worksheet = workbook.Sheets[mapping.sheetName];
    if (!worksheet) {
      errors.push(`Missing required sheet: "${mapping.sheetName}".`);
      continue;
    }

    sheets.push({ sheetName: mapping.sheetName, dataRows: worksheetDataRowCount(worksheet) });
    const missing = missingColumns(mapping, worksheetHeaders(worksheet));
    if (missing.length > 0) {
      errors.push(`Sheet "${mapping.sheetName}" is missing required column(s): ${missing.join(", ")}.`);
    }
  }

  return { sheets, errors };
};

const buildRows = (sheetRows: unknown[][], mapping: SheetMapping) => {
  if (sheetRows.length === 0) return { rows: [] as unknown[][], skippedRows: 0 };

  const headerIndex = getHeaderIndex(sheetRows[0] ?? []);
  const mappedColumns = mapping.columns.map((column) => {
    const source = sourceCandidatesFor(column.column, column.sourceAliases).find((candidate) => headerIndex.has(candidate));
    if (!source) throw new Error(`No source header found for ${mapping.sheetName}.${column.column}`);
    return { ...column, sourceIndex: headerIndex.get(source) as number };
  });

  const importedAt = new Date();
  let skippedRows = 0;
  const rows: unknown[][] = [];

  for (const row of sheetRows.slice(1)) {
    const values = mappedColumns.map((column) => coerceValue(row[column.sourceIndex], column.type));
    if (values.every((value) => value === null)) {
      skippedRows += 1;
      continue;
    }
    rows.push([...values, importedAt]);
  }

  return { rows, skippedRows };
};

const insertBatch = async (
  client: pg.PoolClient,
  tableName: string,
  columns: string[],
  rows: unknown[][],
) => {
  if (rows.length === 0) return;
  const placeholders: string[] = [];
  const values: unknown[] = [];
  const columnCount = columns.length;

  rows.forEach((row, rowIndex) => {
    placeholders.push(`(${row.map((value, columnIndex) => {
      values.push(value);
      return `$${rowIndex * columnCount + columnIndex + 1}`;
    }).join(", ")})`);
  });

  await client.query(
    `INSERT INTO ${quoteTableName(tableName)} (${columns.map(quoteIdent).join(", ")}) VALUES ${placeholders.join(", ")}`,
    values,
  );
};

const importSheet = async (
  client: pg.PoolClient,
  workbook: xlsx.WorkBook,
  mapping: SheetMapping,
  targetSchema: string,
): Promise<ImportSummary> => {
  const worksheet = workbook.Sheets[mapping.sheetName];
  if (!worksheet) throw new Error(`Required workbook sheet not found: "${mapping.sheetName}"`);

  const sheetRows = xlsx.utils.sheet_to_json<unknown[]>(worksheet, {
    header: 1,
    raw: true,
    defval: null,
    blankrows: false,
  });
  const { rows, skippedRows } = buildRows(sheetRows, mapping);
  const columns = [...mapping.columns.map((column) => column.column), "imported_at"];
  const tableName = targetTableName(mapping, targetSchema);

  await client.query(`TRUNCATE TABLE ${quoteTableName(tableName)}`);
  for (let index = 0; index < rows.length; index += batchSize) {
    await insertBatch(client, tableName, columns, rows.slice(index, index + batchSize));
  }

  return { sheetName: mapping.sheetName, tableName, importedRows: rows.length, skippedRows };
};

export const recreateStagingTables = async (client: pg.PoolClient, stagingSchema = "o2_staging") => {
  await client.query(`CREATE SCHEMA IF NOT EXISTS ${quoteIdent(stagingSchema)}`);
  for (const mapping of sheetMappings) {
    const liveTable = quoteTableName(mapping.tableName);
    const stagingTable = quoteTableName(targetTableName(mapping, stagingSchema));
    await client.query(`DROP TABLE IF EXISTS ${stagingTable}`);
    await client.query(`CREATE TABLE ${stagingTable} AS TABLE ${liveTable} WITH NO DATA`);
  }
};

export const importWorkbookToSchema = async (
  client: pg.PoolClient,
  workbook: xlsx.WorkBook,
  targetSchema = "o2_staging",
) => {
  const summaries: ImportSummary[] = [];
  for (const mapping of sheetMappings) {
    const summary = await importSheet(client, workbook, mapping, targetSchema);
    summaries.push(summary);
    console.info(
      `${summary.sheetName} -> ${summary.tableName}: imported ${summary.importedRows}, skipped ${summary.skippedRows}`,
    );
  }
  return summaries;
};

export const readWorkbook = (filePath: string) => xlsx.readFile(filePath, { cellDates: false, raw: true });
