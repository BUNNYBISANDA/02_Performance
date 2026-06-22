import type ExcelJS from "exceljs";
import { saveAs } from "file-saver";

export type ExcelColumnType = "text" | "number" | "percent" | "date";

export type ExcelColumn = {
  key: string;
  header: string;
  width?: number;
  type?: ExcelColumnType;
  align?: "left" | "center" | "right";
};

export type ExcelFilterValue = string | string[] | number | undefined;

export type ExcelExportOptions = {
  fileName: string;
  sheetName: string;
  title: string;
  subtitle?: string;
  filters?: Record<string, ExcelFilterValue>;
  columns: ExcelColumn[];
  rows: Record<string, unknown>[];
  totalsRow?: Record<string, unknown>;
};

const BRAND = {
  navy: "FF0F1B2D",
  blue: "FF1E40AF",
  lightFill: "FFEAF4FF",
  altRow: "FFF8FAFC",
  white: "FFFFFFFF",
  subtitleText: "FF1E293B",
  mutedText: "FF64748B",
};

const THIN_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: "FFD9E2EC" } },
  left: { style: "thin", color: { argb: "FFD9E2EC" } },
  bottom: { style: "thin", color: { argb: "FFD9E2EC" } },
  right: { style: "thin", color: { argb: "FFD9E2EC" } },
};

const defaultAlign = (type?: ExcelColumnType): "left" | "center" | "right" =>
  type === "number" || type === "percent" ? "right" : "left";

export const isPercentColumn = (column: ExcelColumn) => column.type === "percent";

/**
 * The dashboard always stores rates/shares as percentage points (e.g. 4.72 means 4.72%),
 * matching formatRate() in lib/format.ts. Excel's 0.00% format expects a 0-1 fraction,
 * so percentage-point values must be divided by 100 before being written to a cell.
 */
export const normalizePercentForExcel = (value: unknown, alreadyDecimal = false): number => {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return alreadyDecimal ? numeric : numeric / 100;
};

export const formatExcelValue = (value: unknown, column: ExcelColumn): string | number | Date => {
  if (column.type === "percent") return normalizePercentForExcel(value);

  if (column.type === "number") {
    const numeric = typeof value === "number" ? value : Number(value);
    return Number.isFinite(numeric) ? numeric : 0;
  }

  if (column.type === "date") {
    if (!value) return "";
    const date = value instanceof Date ? value : new Date(String(value));
    return Number.isNaN(date.getTime()) ? String(value) : date;
  }

  return value === null || value === undefined ? "" : String(value);
};

const formatFilterEntry = (key: string, value: ExcelFilterValue): string | null => {
  if (value === undefined || value === null || value === "") return null;
  if (Array.isArray(value)) {
    if (value.length === 0) return null;
    return `${key}: ${value.length > 3 ? `${value.length} selected` : value.join(", ")}`;
  }
  return `${key}: ${value}`;
};

export const buildFilterSubtitle = (filters?: Record<string, ExcelFilterValue>): string => {
  if (!filters) return "";
  return Object.entries(filters)
    .map(([key, value]) => formatFilterEntry(key, value))
    .filter((entry): entry is string => Boolean(entry))
    .join("   |   ");
};

const getLocalDate = () => {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
};

const getLocalTimestamp = () => {
  const now = new Date();
  const time = [String(now.getHours()).padStart(2, "0"), String(now.getMinutes()).padStart(2, "0")].join(":");
  return `${getLocalDate()} ${time}`;
};

export const getExcelFileName = (baseName: string) => {
  const withoutExtension = baseName.replace(/\.xlsx$/i, "");
  const withoutExistingDate = withoutExtension.replace(/_\d{4}-\d{2}-\d{2}$/, "");
  const safeBaseName = withoutExistingDate
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");

  return `${safeBaseName || "O2_Table_Export"}_${getLocalDate()}.xlsx`;
};

const applyRowBorderAndAlign = (
  row: ExcelJS.Row,
  columns: ExcelColumn[],
  options: { fill?: string; bold?: boolean; topBorder?: boolean } = {},
) => {
  columns.forEach((column, index) => {
    const cell = row.getCell(index + 1);
    cell.border = options.topBorder
      ? { ...THIN_BORDER, top: { style: "medium", color: { argb: BRAND.navy } } }
      : THIN_BORDER;
    cell.alignment = { vertical: "middle", horizontal: column.align ?? defaultAlign(column.type), wrapText: column.type === "text" };
    if (options.fill) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: options.fill } };
    if (options.bold) cell.font = { ...cell.font, bold: true };
    if (column.type === "percent") cell.numFmt = "0.00%";
    if (column.type === "number") cell.numFmt = "#,##0";
    if (column.type === "date") cell.numFmt = "dd/mm/yyyy";
  });
};

export const buildTableWorkbook = async (options: ExcelExportOptions): Promise<ExcelJS.Workbook> => {
  const { sheetName, title, subtitle, filters, columns, rows, totalsRow } = options;
  if (rows.length === 0) throw new Error("No table data to export.");

  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "O2 Quality Command Center";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(sheetName.slice(0, 31) || "Export");
  const columnCount = columns.length;
  sheet.columns = columns.map((column) => ({ key: column.key, width: column.width ?? 18 }));

  sheet.mergeCells(1, 1, 1, columnCount);
  const titleCell = sheet.getCell(1, 1);
  titleCell.value = title;
  titleCell.font = { bold: true, size: 16, color: { argb: BRAND.white } };
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND.navy } };
  titleCell.alignment = { vertical: "middle", horizontal: "left" };
  sheet.getRow(1).height = 28;

  const subtitleText = subtitle || buildFilterSubtitle(filters) || "All customers, factories, and dates";
  sheet.mergeCells(2, 1, 2, columnCount);
  const subtitleCell = sheet.getCell(2, 1);
  subtitleCell.value = subtitleText;
  subtitleCell.font = { size: 10.5, color: { argb: BRAND.subtitleText } };
  subtitleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND.lightFill } };
  subtitleCell.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
  sheet.getRow(2).height = 18;

  sheet.mergeCells(3, 1, 3, columnCount);
  const generatedCell = sheet.getCell(3, 1);
  generatedCell.value = `Generated: ${getLocalTimestamp()}`;
  generatedCell.font = { italic: true, size: 9, color: { argb: BRAND.mutedText } };
  generatedCell.alignment = { vertical: "middle", horizontal: "left" };

  const headerRowIndex = 5;
  const headerRow = sheet.getRow(headerRowIndex);
  columns.forEach((column, index) => {
    const cell = headerRow.getCell(index + 1);
    cell.value = column.header;
    cell.font = { bold: true, color: { argb: BRAND.white } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND.blue } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = THIN_BORDER;
  });
  headerRow.height = 22;

  sheet.autoFilter = { from: { row: headerRowIndex, column: 1 }, to: { row: headerRowIndex, column: columnCount } };
  sheet.views = [{ state: "frozen", ySplit: headerRowIndex }];

  rows.forEach((row, rowIndex) => {
    const excelRow = sheet.getRow(headerRowIndex + 1 + rowIndex);
    columns.forEach((column, columnIndex) => {
      excelRow.getCell(columnIndex + 1).value = formatExcelValue(row[column.key], column);
    });
    applyRowBorderAndAlign(excelRow, columns, { fill: rowIndex % 2 === 0 ? BRAND.white : BRAND.altRow });
  });

  if (totalsRow) {
    const excelTotalsRow = sheet.getRow(headerRowIndex + 1 + rows.length);
    columns.forEach((column, columnIndex) => {
      const value = totalsRow[column.key];
      excelTotalsRow.getCell(columnIndex + 1).value = value === undefined ? "" : formatExcelValue(value, column);
    });
    applyRowBorderAndAlign(excelTotalsRow, columns, { fill: BRAND.lightFill, bold: true, topBorder: true });
  }

  return workbook;
};

export const exportTableToExcel = async (options: ExcelExportOptions): Promise<void> => {
  const workbook = await buildTableWorkbook(options);
  const buffer = await workbook.xlsx.writeBuffer();
  saveAs(new Blob([buffer], { type: "application/octet-stream" }), getExcelFileName(options.fileName));
};
