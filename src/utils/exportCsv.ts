export type CsvRow = Record<string, unknown>;

const getLocalDate = () => {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
};

const getCsvFileName = (baseName: string) => {
  const safeBaseName = baseName
    .replace(/\.(csv|png|pdf)$/i, "")
    .replace(/_\d{4}-\d{2}-\d{2}$/, "")
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
  return `${safeBaseName || "O2_Table_Export"}_${getLocalDate()}.csv`;
};

const formatCsvValue = (value: unknown) => {
  if (value === null || value === undefined) return "";
  const text = typeof value === "object" ? JSON.stringify(value) : String(value);
  return `"${text.replace(/"/g, '""')}"`;
};

export const exportRowsAsCsv = (rows: CsvRow[], fileName: string) => {
  if (rows.length === 0) throw new Error("No table rows are available to export.");

  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  const csv = [
    columns.map(formatCsvValue).join(","),
    ...rows.map((row) => columns.map((column) => formatCsvValue(row[column])).join(",")),
  ].join("\r\n");
  const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.download = getCsvFileName(fileName);
  link.href = url;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
};
