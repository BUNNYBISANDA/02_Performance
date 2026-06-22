import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatRate } from "../lib/format";

type TrendSeries = {
  key: string;
  name: string;
  color: string;
  target?: number;
};

export function TrendChart({
  data,
  series,
  height = 320,
}: {
  data: Record<string, string | number>[];
  series: TrendSeries[];
  height?: number;
}) {
  const targets = series.filter((item) => item.target !== undefined);

  return (
    <div className="h-full rounded-lg border border-slate-200 bg-white p-4 shadow-card">
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 16, right: 16, bottom: 8, left: -16 }}>
          <CartesianGrid stroke="#dce8f0" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="week" tickLine={false} axisLine={false} minTickGap={22} />
          <YAxis tickLine={false} axisLine={false} tickFormatter={(value) => `${value}%`} />
          <Tooltip
            formatter={(value) => formatRate(Number(value))}
            contentStyle={{
              border: "1px solid #dce8f0",
              borderRadius: 8,
              boxShadow: "0 12px 28px rgba(15, 45, 72, 0.12)",
            }}
          />
          <Legend iconType="circle" />
          {targets.map((item) => (
            <ReferenceLine
              key={`${item.key}-target`}
              y={item.target}
              stroke={item.color}
              strokeDasharray="5 5"
              strokeOpacity={0.45}
            />
          ))}
          {series.map((item) => (
            <Line
              key={item.key}
              type="monotone"
              dataKey={item.key}
              name={item.name}
              stroke={item.color}
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 4 }}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
