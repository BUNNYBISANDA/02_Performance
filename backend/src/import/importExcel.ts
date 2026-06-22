import dotenv from "dotenv";
import { existsSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import pg from "pg";
import xlsx from "xlsx";
import { closePool, pool } from "../db/pool.js";
import { refreshMaterializedViews } from "../db/refreshMaterializedViews.js";
import { toPostgresDateString } from "../utils/excelDate.js";
import { normalizeHeader, normalizeTextValue, toNumberOrNull } from "../utils/normalize.js";
import { type ColumnType, type SheetMapping, sheetMappings } from "./sheetMappings.js";

dotenv.config();

const batchSize = 1000;
const defaultExcelPath = "backend/data/7QA_All_Customer_v2.xlsx";

type ImportSummary = {
  sheetName: string;
  tableName: string;
  importedRows: number;
  skippedRows: number;
};

const quoteIdent = (identifier: string) => `"${identifier.replace(/"/g, '""')}"`;

const quoteTableName = (tableName: string) => tableName.split(".").map(quoteIdent).join(".");

const resolveExcelPath = () => {
  const configuredPath = process.env.EXCEL_FILE_PATH ?? defaultExcelPath;

  if (path.isAbsolute(configuredPath)) {
    if (!existsSync(configuredPath)) {
      throw new Error(`Excel file not found at EXCEL_FILE_PATH=${configuredPath}`);
    }

    return configuredPath;
  }

  const candidates = [
    path.resolve(process.cwd(), configuredPath),
    path.resolve(process.cwd(), "..", configuredPath),
    configuredPath.startsWith("backend/")
      ? path.resolve(process.cwd(), configuredPath.replace(/^backend\//, ""))
      : null,
  ].filter((candidate): candidate is string => Boolean(candidate));

  const found = candidates.find((candidate) => existsSync(candidate));
  if (!found) {
    throw new Error(
      `Excel file not found. EXCEL_FILE_PATH=${configuredPath}. Checked: ${candidates.join(", ")}`,
    );
  }

  return found;
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
    if (normalized && !index.has(normalized)) {
      index.set(normalized, position);
    }
  });

  return index;
};

const validateMappingHeaders = (mapping: SheetMapping, headerIndex: Map<string, number>) => {
  const missing = mapping.columns
    .filter((column) => !sourceCandidatesFor(column.column, column.sourceAliases).some((source) => headerIndex.has(source)))
    .map((column) => column.column);

  if (missing.length > 0) {
    throw new Error(
      `Sheet "${mapping.sheetName}" is missing expected column(s): ${missing.join(", ")}`,
    );
  }
};

const buildRows = (sheetRows: unknown[][], mapping: SheetMapping) => {
  if (sheetRows.length === 0) {
    return { rows: [] as unknown[][], skippedRows: 0 };
  }

  const headerIndex = getHeaderIndex(sheetRows[0] ?? []);
  validateMappingHeaders(mapping, headerIndex);

  const mappedColumns = mapping.columns.map((column) => {
    const source = sourceCandidatesFor(column.column, column.sourceAliases).find((candidate) =>
      headerIndex.has(candidate),
    );

    if (!source) {
      throw new Error(`No source header found for ${mapping.sheetName}.${column.column}`);
    }

    return {
      ...column,
      sourceIndex: headerIndex.get(source) as number,
    };
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
    const rowPlaceholders = row.map((value, columnIndex) => {
      values.push(value);
      return `$${rowIndex * columnCount + columnIndex + 1}`;
    });

    placeholders.push(`(${rowPlaceholders.join(", ")})`);
  });

  const sql = `
    INSERT INTO ${quoteTableName(tableName)}
      (${columns.map(quoteIdent).join(", ")})
    VALUES ${placeholders.join(", ")}
  `;

  await client.query(sql, values);
};

const importSheet = async (
  client: pg.PoolClient,
  workbook: xlsx.WorkBook,
  mapping: SheetMapping,
): Promise<ImportSummary> => {
  const worksheet = workbook.Sheets[mapping.sheetName];
  if (!worksheet) {
    throw new Error(`Required workbook sheet not found: "${mapping.sheetName}"`);
  }

  const rows = xlsx.utils.sheet_to_json<unknown[]>(worksheet, {
    header: 1,
    raw: true,
    defval: null,
    blankrows: false,
  });

  const { rows: importRows, skippedRows } = buildRows(rows, mapping);
  const targetColumns = [...mapping.columns.map((column) => column.column), "imported_at"];

  await client.query(`TRUNCATE TABLE ${quoteTableName(mapping.tableName)} RESTART IDENTITY`);

  for (let index = 0; index < importRows.length; index += batchSize) {
    const batch = importRows.slice(index, index + batchSize);
    await insertBatch(client, mapping.tableName, targetColumns, batch);
  }

  return {
    sheetName: mapping.sheetName,
    tableName: mapping.tableName,
    importedRows: importRows.length,
    skippedRows,
  };
};

export const importExcelWorkbook = async () => {
  const excelPath = resolveExcelPath();
  console.log(`Reading workbook: ${excelPath}`);

  const workbook = xlsx.readFile(excelPath, {
    cellDates: false,
    raw: true,
  });

  const client = await pool.connect();
  const summaries: ImportSummary[] = [];
  let transactionOpen = false;

  try {
    await client.query("BEGIN");
    transactionOpen = true;

    for (const mapping of sheetMappings) {
      try {
        const summary = await importSheet(client, workbook, mapping);
        summaries.push(summary);
        console.log(
          `${summary.sheetName} -> ${summary.tableName}: imported ${summary.importedRows}, skipped ${summary.skippedRows}`,
        );
      } catch (error) {
        console.error(`Import failed for sheet "${mapping.sheetName}" -> ${mapping.tableName}`);
        throw error;
      }
    }

    await client.query("COMMIT");
    transactionOpen = false;
    console.log("Excel import completed.");
    await refreshMaterializedViews(client);
    return summaries;
  } catch (error) {
    if (transactionOpen) await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

importExcelWorkbook()
  .catch((error) => {
    console.error("Excel import failed:");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePool();
  });
