import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatNumber, formatRate } from "../lib/format";

export function TopDefectBarChart({
  data,
  color = "#11b7d9",
  valueKey = "defects",
  height = 340,
}: {
  data: Array<{ name: string; defects?: number; rate?: number; value?: number }>;
  color?: string;
  valueKey?: "defects" | "rate" | "value";
  height?: number;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-card">
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} layout="vertical" margin={{ top: 8, right: 28, bottom: 8, left: 20 }}>
          <CartesianGrid stroke="#dce8f0" strokeDasharray="3 3" horizontal={false} />
          <XAxis
            type="number"
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => (valueKey === "rate" ? `${value}%` : formatNumber(Number(value)))}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={150}
            tickLine={false}
            axisLine={false}
            interval={0}
          />
          <Tooltip
            formatter={(value) => (valueKey === "rate" ? formatRate(Number(value)) : formatNumber(Number(value)))}
            contentStyle={{
              border: "1px solid #dce8f0",
              borderRadius: 8,
              boxShadow: "0 12px 28px rgba(15, 45, 72, 0.12)",
            }}
          />
          <Bar dataKey={valueKey} fill={color} radius={[0, 6, 6, 0]} barSize={18} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
