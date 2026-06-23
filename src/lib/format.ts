export const formatNumber = (value: number) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);

export const formatRate = (value: number) => `${value.toFixed(2)}%`;

export const formatDelta = (value: number) => {
  if (!Number.isFinite(value)) return "0.0 pp";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)} pp`;
};

/**
 * Builds a deterministic, evenly-spaced set of percent-axis ticks instead of relying on
 * Recharts' auto-generated ticks, which can pick a fractional step (e.g. 0.5) while a
 * tickFormatter still rounds to whole numbers — producing duplicate-looking labels like
 * "1%, 1%, 2%, 2%". Returns both the tick values and how many decimals they need so every
 * tick in the set is formatted consistently (either all whole percent, or all one-decimal).
 */
export const buildNicePercentTicks = (maxValue: number, tickCount = 5) => {
  const safeMax = Number.isFinite(maxValue) && maxValue > 0 ? maxValue : 1;
  const rawStep = safeMax / (tickCount - 1);
  const step = rawStep <= 0.5 ? 0.5 : Math.ceil(rawStep);
  const decimals = step % 1 !== 0 ? 1 : 0;
  const ticks = Array.from({ length: tickCount }, (_, index) => Number((step * index).toFixed(1)));
  return { ticks, max: ticks[ticks.length - 1], decimals };
};

export const formatPercentTick = (value: number, decimals: number) => `${value.toFixed(decimals)}%`;
