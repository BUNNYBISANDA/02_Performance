export const formatNumber = (value: number) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);

export const formatRate = (value: number) => `${value.toFixed(2)}%`;

export const formatDelta = (value: number) => {
  if (!Number.isFinite(value)) return "0.0 pp";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)} pp`;
};
