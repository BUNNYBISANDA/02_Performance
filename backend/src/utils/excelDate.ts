const excelEpochUtc = Date.UTC(1899, 11, 30);
const millisecondsPerDay = 86_400_000;

export const excelSerialDateToJSDate = (serial: number): Date | null => {
  if (!Number.isFinite(serial)) return null;

  return new Date(excelEpochUtc + serial * millisecondsPerDay);
};

export const parseExcelDate = (value: unknown): Date | null => {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;

  if (typeof value === "number") {
    return excelSerialDateToJSDate(value);
  }

  const text = String(value).trim();
  if (text.length === 0) return null;

  const numeric = Number(text);
  if (Number.isFinite(numeric) && numeric > 20_000 && numeric < 80_000) {
    return excelSerialDateToJSDate(numeric);
  }

  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const toPostgresDateString = (value: unknown): string | null => {
  const date = parseExcelDate(value);
  return date ? date.toISOString().slice(0, 10) : null;
};
