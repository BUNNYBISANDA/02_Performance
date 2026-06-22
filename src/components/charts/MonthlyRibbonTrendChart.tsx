import { useMemo, useState } from "react";
import { ExportMenu } from "../common/ExportMenu";

type MonthlyTrendRow = Record<string, string | number>;

type StageKey = "Inline" | "Endline" | "Pre Final" | "Final" | "Third Party";

type StageConfig = {
  key: StageKey;
  sampleKey: string;
  label: string;
  color: string;
};

type StageValue = StageConfig & {
  value: number;
};

type PositionedSegment = StageValue & {
  month: string;
  x: number;
  y0: number;
  y1: number;
  centerY: number;
  height: number;
  rank: number;
};

type MonthStack = {
  month: string;
  x: number;
  total: number;
  segments: PositionedSegment[];
};

type TooltipState = {
  x: number;
  y: number;
  month: string;
  stage: string;
  value?: number;
  fromValue?: number;
  toValue?: number;
};

const WIDTH = 1280;
const HEIGHT = 500;
const PLOT_TOP = 18;
const PLOT_BOTTOM = HEIGHT - 58;
const Y_AXIS_LABEL_X = 14;
const Y_AXIS_TICK_X = 80;
const PLOT_START_X = 140;
const PLOT_END_X = WIDTH - 28;
const FIRST_COLUMN_GAP = 32;
const COLUMN_WIDTH = 82;
const FIRST_COLUMN_CENTER = PLOT_START_X + FIRST_COLUMN_GAP + COLUMN_WIDTH / 2;
const LAST_COLUMN_CENTER = PLOT_END_X - COLUMN_WIDTH / 2;
const PLOT_WIDTH = PLOT_END_X - PLOT_START_X;
const PLOT_HEIGHT = PLOT_BOTTOM - PLOT_TOP;

const SERIES: StageConfig[] = [
  { key: "Inline", sampleKey: "inline", label: "Inline Defect Rate", color: "#1E90FF" },
  { key: "Endline", sampleKey: "endline", label: "Endline Defect Rate", color: "#1428A0" },
  { key: "Pre Final", sampleKey: "preFinal", label: "Pre Final Defect Rate", color: "#EA6A32" },
  { key: "Final", sampleKey: "final", label: "Final Defect Rate", color: "#7B168F" },
  { key: "Third Party", sampleKey: "thirdParty", label: "Third Party Defect Rate", color: "#E044A7" },
];

const formatRate = (value: number) => `${value.toFixed(2)}%`;

const getValue = (row: MonthlyTrendRow, series: StageConfig) => {
  const raw = row[series.key] ?? row[series.sampleKey] ?? 0;
  const value = Number(raw);
  return Number.isFinite(value) ? value : 0;
};

const makeRibbonPath = (from: PositionedSegment, to: PositionedSegment) => {
  const startX = from.x + COLUMN_WIDTH / 2;
  const endX = to.x - COLUMN_WIDTH / 2;
  const distance = endX - startX;
  const c1 = startX + distance * 0.48;
  const c2 = endX - distance * 0.48;

  return [
    `M ${startX} ${from.y0}`,
    `C ${c1} ${from.y0}, ${c2} ${to.y0}, ${endX} ${to.y0}`,
    `L ${endX} ${to.y1}`,
    `C ${c2} ${to.y1}, ${c1} ${from.y1}, ${startX} ${from.y1}`,
    "Z",
  ].join(" ");
};

const toMonthStacks = (data: MonthlyTrendRow[]): { stacks: MonthStack[]; maxTotal: number; yTicks: number[] } => {
  if (data.length === 0) {
    return { stacks: [], maxTotal: 10, yTicks: [0, 5, 10] };
  }

  const normalized = data.map((row, index) => {
    const month = String(row.month);
    const values = SERIES.map((series): StageValue => ({
      ...series,
      value: getValue(row, series),
    })).sort((a, b) => b.value - a.value);

    return {
      month,
      index,
      values,
      total: values.reduce((sum, item) => sum + item.value, 0),
    };
  });

  const maxTotal = Math.max(1, ...normalized.map((row) => row.total));
  const roundedMax = Math.max(10, Math.ceil(maxTotal / 5) * 5);
  const scale = PLOT_HEIGHT / roundedMax;
  const centerSpan = LAST_COLUMN_CENTER - FIRST_COLUMN_CENTER;
  const step = normalized.length > 1 ? centerSpan / (normalized.length - 1) : 0;
  const yTicks = Array.from({ length: Math.floor(roundedMax / 5) + 1 }, (_, index) => index * 5);

  const stacks = normalized.map((row) => {
    const x =
      normalized.length > 1
        ? FIRST_COLUMN_CENTER + row.index * step
        : PLOT_START_X + PLOT_WIDTH / 2;
    const stackTop = PLOT_BOTTOM - row.total * scale;
    let cursor = stackTop;

    const segments = row.values.map((item, rank): PositionedSegment => {
      const height = item.value * scale;
      const y0 = cursor;
      const y1 = cursor + height;
      cursor = y1;

      return {
        ...item,
        month: row.month,
        x,
        y0,
        y1,
        centerY: y0 + height / 2,
        height,
        rank,
      };
    });

    return {
      month: row.month,
      x,
      total: row.total,
      segments,
    };
  });

  return { stacks, maxTotal: roundedMax, yTicks };
};

export function MonthlyRibbonTrendChart({ data }: { data: MonthlyTrendRow[] }) {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [hoveredStage, setHoveredStage] = useState<string | null>(null);
  const { stacks, maxTotal, yTicks } = useMemo(() => toMonthStacks(data), [data]);

  const yForTick = (tick: number) => PLOT_BOTTOM - (tick / maxTotal) * PLOT_HEIGHT;

  const ribbonPairs = stacks.slice(0, -1).flatMap((stack, index) => {
    const nextStack = stacks[index + 1];
    return SERIES.flatMap((series) => {
      const from = stack.segments.find((segment) => segment.key === series.key);
      const to = nextStack.segments.find((segment) => segment.key === series.key);
      return from && to ? [{ from, to, series }] : [];
    });
  });

  return (
    <div id="executive-monthly-ribbon-chart" className="relative rounded-lg border border-slate-200 bg-white p-3 shadow-card">
      <div className="mb-1 flex flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-display text-lg font-semibold text-slate-900">
            Monthly Defect Rate Trend by Inspection Stage
          </h2>
          <ExportMenu
            targetId="executive-monthly-ribbon-chart"
            fileName="O2_Monthly_Defect_Rate_Trend"
          />
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5">
          {SERIES.map((series) => (
            <button
              key={series.key}
              type="button"
              className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700"
              onMouseEnter={() => setHoveredStage(series.key)}
              onMouseLeave={() => setHoveredStage(null)}
            >
              <span className="h-3 w-3 rounded-full" style={{ backgroundColor: series.color }} />
              {series.label}
            </button>
          ))}
        </div>
      </div>

      <div className="relative">
        <svg
          width={WIDTH}
          height={HEIGHT}
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="h-[500px] w-full overflow-visible"
          role="img"
          aria-label="Monthly Defect Rate Trend by Inspection Stage ribbon chart"
          onMouseLeave={() => {
            setTooltip(null);
            setHoveredStage(null);
          }}
        >
        <defs>
          <filter id="ribbon-soft-shadow" x="-10%" y="-10%" width="120%" height="120%">
            <feDropShadow dx="0" dy="5" stdDeviation="5" floodColor="#0f172a" floodOpacity="0.12" />
          </filter>
          {SERIES.map((series) => (
            <linearGradient key={series.key} id={`ribbon-${series.key.replace(/\s/g, "-")}`} x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%" stopColor={series.color} stopOpacity="0.52" />
              <stop offset="50%" stopColor={series.color} stopOpacity="0.72" />
              <stop offset="100%" stopColor={series.color} stopOpacity="0.52" />
            </linearGradient>
          ))}
        </defs>

        <rect x={0} y={0} width={WIDTH} height={HEIGHT} fill="#ffffff" />

        <g aria-hidden="true">
          {yTicks.map((tick) => (
            <g key={tick}>
              <line
                x1={PLOT_START_X}
                x2={PLOT_END_X}
                y1={yForTick(tick)}
                y2={yForTick(tick)}
                stroke="#e2e8f0"
                strokeDasharray={tick === 0 ? "0" : "4 5"}
              />
              <text x={Y_AXIS_TICK_X} y={yForTick(tick) + 4} textAnchor="end" fill="#64748b" fontSize={12} fontWeight={600}>
                {tick}%
              </text>
            </g>
          ))}
          <line x1={PLOT_START_X} x2={PLOT_START_X} y1={PLOT_TOP} y2={PLOT_BOTTOM} stroke="#cbd5e1" />
          <line x1={PLOT_START_X} x2={PLOT_END_X} y1={PLOT_BOTTOM} y2={PLOT_BOTTOM} stroke="#cbd5e1" />
            <text
              x={Y_AXIS_LABEL_X}
              y={PLOT_TOP + PLOT_HEIGHT / 2}
              transform={`rotate(-90 ${Y_AXIS_LABEL_X} ${PLOT_TOP + PLOT_HEIGHT / 2})`}
              textAnchor="middle"
              fill="#64748b"
              fontSize={12}
              fontWeight={700}
            >
              Defect rate percentage
            </text>
        </g>

        <g filter="url(#ribbon-soft-shadow)">
          {ribbonPairs.map(({ from, to, series }, index) => {
            const isDimmed = hoveredStage !== null && hoveredStage !== series.key;
            return (
              <path
                key={`${series.key}-${from.month}-${to.month}-${index}`}
                d={makeRibbonPath(from, to)}
                fill={`url(#ribbon-${series.key.replace(/\s/g, "-")})`}
                opacity={isDimmed ? 0.22 : 1}
                stroke="rgba(255,255,255,0.36)"
                strokeWidth={1.25}
                className="transition-opacity duration-150"
                onMouseEnter={() => {
                  setHoveredStage(series.key);
                  setTooltip({
                    x: (from.x + to.x) / 2,
                    y: (from.centerY + to.centerY) / 2,
                    month: `${from.month} to ${to.month}`,
                    stage: series.label,
                    fromValue: from.value,
                    toValue: to.value,
                  });
                }}
              />
            );
          })}
        </g>

        <g>
          {stacks.map((stack) => (
            <g key={stack.month}>
              {stack.segments.map((segment) => {
                const isDimmed = hoveredStage !== null && hoveredStage !== segment.key;
                return (
                  <g key={`${stack.month}-${segment.key}`}>
                    <rect
                      x={segment.x - COLUMN_WIDTH / 2}
                      y={segment.y0}
                      width={COLUMN_WIDTH}
                      height={Math.max(segment.height, 1)}
                      rx={7}
                      fill={segment.color}
                      opacity={isDimmed ? 0.38 : 0.94}
                      stroke="#ffffff"
                      strokeWidth={1.6}
                      className="transition-opacity duration-150"
                      onMouseEnter={() => {
                        setHoveredStage(segment.key);
                        setTooltip({
                          x: segment.x,
                          y: segment.centerY,
                          month: segment.month,
                          stage: segment.label,
                          value: segment.value,
                        });
                      }}
                    />
                    {segment.value >= 1.3 && segment.height >= 15 && (
                      <text
                        x={segment.x}
                        y={segment.centerY + 4}
                        textAnchor="middle"
                        fill="#ffffff"
                        fontSize={12}
                        fontWeight={800}
                        pointerEvents="none"
                        style={{ textShadow: "0 1px 2px rgba(15,23,42,0.45)" }}
                      >
                        {formatRate(segment.value)}
                      </text>
                    )}
                  </g>
                );
              })}
              <text x={stack.x} y={PLOT_BOTTOM + 24} textAnchor="middle" fill="#334155" fontSize={13} fontWeight={800}>
                {stack.month}
              </text>
            </g>
          ))}
        </g>
          <text
            x={PLOT_START_X + PLOT_WIDTH / 2}
            y={HEIGHT - 10}
            textAnchor="middle"
            fill="#64748b"
            fontSize={12}
            fontWeight={700}
          >
            Month Name
          </text>
        </svg>

        {tooltip && (
          <div
            className="pointer-events-none absolute z-20 rounded-md border border-slate-200 bg-white/[0.98] px-3 py-2 text-xs text-slate-700 shadow-lift"
            style={{
              left: `${(tooltip.x / WIDTH) * 100}%`,
              top: `${(tooltip.y / HEIGHT) * 100}%`,
              transform: "translate(10px, -100%)",
            }}
          >
            <div className="font-bold text-slate-950">{tooltip.month}</div>
            <div>{tooltip.stage}</div>
            {tooltip.value !== undefined ? (
              <div>
                Defect rate: <span className="font-bold">{formatRate(tooltip.value)}</span>
              </div>
            ) : (
              <div>
                Defect rate:{" "}
                <span className="font-bold">
                  {formatRate(tooltip.fromValue ?? 0)} to {formatRate(tooltip.toValue ?? 0)}
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
