const headerAliases: Record<string, string> = {
  defectqty: "defect_qty",
  inspet_qty: "inspect_qty",
  inspet: "inspect",
  sortname: "sort_name",
};

export const normalizeHeader = (value: unknown): string => {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/%/g, " percent ")
    .replace(/#/g, " no ")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");

  return headerAliases[normalized] ?? normalized;
};

export const normalizeTextValue = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;

  const text = String(value).trim();
  return text.length === 0 ? null : text;
};

export const toNumberOrNull = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;

  const text = String(value).trim();
  if (text.length === 0) return null;

  const normalized = text.replace(/,/g, "").replace(/%$/, "");
  const numberValue = Number(normalized);

  return Number.isFinite(numberValue) ? numberValue : null;
};
