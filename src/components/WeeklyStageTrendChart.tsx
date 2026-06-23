import {
  CartesianGrid,
  LabelList,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useState } from "react";
import { formatRate } from "../lib/format";
import type { WeeklyTrendItem } from "../types/api";
import { ExportMenu } from "./common/ExportMenu";

type SeriesKey = "inline" | "endline" | "preFinal" | "final" | "thirdParty";

type SeriesConfig = {
  key: SeriesKey;
  label: string;
  color: string;
  target: number;
};

const SERIES: SeriesConfig[] = [
  { key: "inline", label: "Inline Defect Rate", color: "#1E90FF", target: 3.5 },
  { key: "endline", label: "Endline Defect Rate", color: "#1428A0", target: 2.0 },
  { key: "preFinal", label: "Pre Final Defect Rate", color: "#EA6A32", target: 1.2 },
  { key: "final", label: "Final Defect Rate", color: "#7B168F", target: 0.7 },
  { key: "thirdParty", label: "Third Party Defect Rate", color: "#E044A7", target: 0.5 },
];

type Highlight = { isoWeek: string; key: SeriesKey };

function WeekMonthTick(props: any) {
  const { x, y, payload, data } = props;
  const index = payload?.index ?? 0;
  const month = data[index]?.month;
  const previousMonth = index > 0 ? data[index - 1]?.month : undefined;
  const showMonth = month && month !== previousMonth;

  return (
    <g transform={`translate(${x},${y})`}>
      <text x={0} y={0} dy={12} textAnchor="middle" fill="#60758c" fontSize={11}>
        {payload.value}
      </text>
      {showMonth && (
        <text x={0} y={0} dy={29} textAnchor="middle" fill="#1f2a7a" fontSize={11} fontWeight={700}>
          {month}
        </text>
      )}
    </g>
  );
}

export function WeeklyStageTrendChart({
  data,
  highlights = [],
  viewBy = "weekly",
  onViewByChange,
}: {
  data: WeeklyTrendItem[];
  highlights?: Highlight[];
  viewBy?: "weekly" | "daily";
  onViewByChange?: (viewBy: "weekly" | "daily") => void;
}) {
  const [hoveredSeries, setHoveredSeries] = useState<SeriesKey | null>(null);
  const highlightLookup = new Set(highlights.map((item) => `${item.isoWeek}|${item.key}`));
  const xAxisKey = viewBy === "daily" ? "label" : "isoWeek";

  return (
    <div id="weekly-trend-chart" className="rounded-lg border border-slate-200 bg-white p-4 shadow-card transition-[transform,box-shadow,border-color] duration-200 ease-out hover:-translate-y-0.5 hover:border-cyan-200 hover:shadow-lift">
      <div className="mb-3 flex items-start justify-between gap-3">
        <h2 className="font-display text-lg font-semibold text-slate-900">
          Weekly Defect Rate Trend by Inspection Stage
        </h2>
        <div className="flex items-center gap-2">
          {onViewByChange && (
            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
              <span className="hidden sm:inline">View By</span>
              <select
                value={viewBy}
                onChange={(event) => onViewByChange(event.target.value as "weekly" | "daily")}
                className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700 outline-none focus:border-[#00AEEF] focus:ring-2 focus:ring-cyan-100"
              >
                <option value="weekly">Week</option>
                <option value="daily">Day</option>
              </select>
            </label>
          )}
          <ExportMenu targetId="weekly-trend-chart" fileName="O2_Weekly_Defect_Rate_Trend" />
        </div>
      </div>
      <ResponsiveContainer width="100%" height={620}>
        <LineChart data={data} margin={{ top: 24, right: 36, bottom: 44, left: -8 }}>
          <CartesianGrid stroke="#d9e2ef" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey={xAxisKey}
            interval={0}
            height={64}
            tickLine={false}
            axisLine={false}
            tick={(props) => <WeekMonthTick {...props} data={data} />}
            label={{
              value: viewBy === "daily" ? "Date" : "ISO Week",
              position: "insideBottom",
              offset: -8,
              fill: "#475569",
              fontSize: 12,
              fontWeight: 700,
            }}
          />
          <YAxis tickLine={false} axisLine={false} tickFormatter={(value) => `${Number(value).toFixed(0)}%`} />
          <Tooltip
            formatter={(value) => formatRate(Number(value))}
            contentStyle={{
              border: "1px solid #d9e2ef",
              borderRadius: 8,
              boxShadow: "0 14px 34px rgba(15, 45, 72, 0.12)",
            }}
          />
          <Legend
            verticalAlign="top"
            align="left"
            wrapperStyle={{ paddingBottom: 14 }}
            content={() => (
              <div
                className="flex flex-wrap items-center gap-x-5 gap-y-1.5 pb-3.5 text-sm font-semibold text-slate-700"
                onMouseLeave={() => setHoveredSeries(null)}
              >
                {SERIES.map((series) => (
                  <button
                    key={series.key}
                    type="button"
                    className="inline-flex items-center gap-2 transition-opacity duration-150"
                    style={{ opacity: hoveredSeries && hoveredSeries !== series.key ? 0.28 : 1 }}
                    onMouseEnter={() => setHoveredSeries(series.key)}
                    onFocus={() => setHoveredSeries(series.key)}
                    onBlur={() => setHoveredSeries(null)}
                    aria-label={`Highlight ${series.label}`}
                  >
                    <span className="h-3 w-3 rounded-full" style={{ backgroundColor: series.color }} />
                    {series.label}
                  </button>
                ))}
              </div>
            )}
          />
          {SERIES.map((series, index) => (
            <ReferenceLine
              key={`${series.key}-target`}
              y={series.target}
              stroke="#E11D48"
              strokeDasharray={index % 2 === 0 ? "6 5" : "2 5"}
              strokeOpacity={hoveredSeries && hoveredSeries !== series.key ? 0.1 : 0.42}
            />
          ))}
          {SERIES.map((series) => (
            <Line
              key={series.key}
              type="monotone"
              dataKey={series.key}
              name={series.label}
              stroke={series.color}
              strokeWidth={2.5}
              strokeOpacity={hoveredSeries && hoveredSeries !== series.key ? 0.25 : 1}
              dot={false}
              activeDot={{ r: 5 }}
              style={{ transition: "stroke-opacity 160ms ease" }}
            >
              <LabelList
                content={(props: any) => {
                  const row = data[props.index];
                  if (!row || props.value === undefined) return null;
                  if (!highlightLookup.has(`${row.isoWeek}|${series.key}`)) return null;
                  return (
                    <text
                      x={Number(props.x)}
                      y={Number(props.y) - 8}
                      fill={series.color}
                      fontSize={11}
                      fontWeight={700}
                      textAnchor="middle"
                    >
                      {formatRate(Number(props.value))}
                    </text>
                  );
                }}
              />
            </Line>
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
