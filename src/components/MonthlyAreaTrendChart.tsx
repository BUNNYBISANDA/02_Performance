import {
  Area,
  AreaChart,
  CartesianGrid,
  LabelList,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatRate } from "../lib/format";
import { INSPECTION_STAGES, STAGE_META } from "../lib/stageConfig";

export function MonthlyAreaTrendChart({ data }: { data: Record<string, string | number>[] }) {
  const latestIndex = Math.max(data.length - 1, 0);

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-card">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="font-display text-lg font-semibold text-slate-900">
          Monthly Defect Rate Trend by Inspection Stage
        </h2>
      </div>
      <ResponsiveContainer width="100%" height={430}>
        <AreaChart data={data} margin={{ top: 22, right: 42, bottom: 12, left: -10 }}>
          <defs>
            {INSPECTION_STAGES.map((stage) => (
              <linearGradient key={stage} id={`monthly-${stage.replace(/\s/g, "-")}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={STAGE_META[stage].color} stopOpacity={0.38} />
                <stop offset="95%" stopColor={STAGE_META[stage].color} stopOpacity={0.07} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid stroke="#d9e2ef" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="month" tickLine={false} axisLine={false} />
          <YAxis tickLine={false} axisLine={false} tickFormatter={(value) => `${Number(value).toFixed(0)}%`} />
          <Tooltip
            formatter={(value) => formatRate(Number(value))}
            contentStyle={{
              border: "1px solid #d9e2ef",
              borderRadius: 8,
              boxShadow: "0 14px 34px rgba(15, 45, 72, 0.12)",
            }}
          />
          <Legend verticalAlign="top" align="left" iconType="circle" wrapperStyle={{ paddingBottom: 14 }} />
          {INSPECTION_STAGES.map((stage) => (
            <Area
              key={stage}
              type="monotone"
              dataKey={stage}
              name={`${stage} Defect Rate`}
              stroke={STAGE_META[stage].color}
              strokeWidth={2.5}
              fill={`url(#monthly-${stage.replace(/\s/g, "-")})`}
              dot={{ r: 2.5, strokeWidth: 1 }}
              activeDot={{ r: 5 }}
            >
              <LabelList
                content={(props: any) => {
                  if (props.index !== latestIndex || props.value === undefined) return null;
                  return (
                    <text
                      x={Number(props.x) + 8}
                      y={Number(props.y) - 5}
                      fill={STAGE_META[stage].color}
                      fontSize={11}
                      fontWeight={700}
                    >
                      {formatRate(Number(props.value))}
                    </text>
                  );
                }}
              />
            </Area>
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
