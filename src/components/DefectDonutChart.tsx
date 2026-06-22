import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { formatNumber } from "../lib/format";

const palette = ["#0f9f8f", "#11b7d9", "#6c7ff2", "#f59f0b", "#e2556d", "#7c8aa0", "#3a5571"];

export function DefectDonutChart({
  data,
  height = 300,
}: {
  data: Array<{ name: string; defects: number }>;
  height?: number;
}) {
  const total = data.reduce((sum, item) => sum + item.defects, 0);

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-card">
      <div className="grid gap-4 sm:grid-cols-[1fr_180px] sm:items-center">
        <ResponsiveContainer width="100%" height={height}>
          <PieChart>
            <Pie
              data={data}
              dataKey="defects"
              nameKey="name"
              innerRadius="62%"
              outerRadius="86%"
              paddingAngle={2}
              stroke="#ffffff"
              strokeWidth={2}
            >
              {data.map((entry, index) => (
                <Cell key={entry.name} fill={palette[index % palette.length]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value) => formatNumber(Number(value))}
              contentStyle={{
                border: "1px solid #dce8f0",
                borderRadius: 8,
                boxShadow: "0 12px 28px rgba(15, 45, 72, 0.12)",
              }}
            />
          </PieChart>
        </ResponsiveContainer>

        <div className="space-y-2">
          <div className="text-xs font-semibold uppercase text-command-steel">Defect Mix</div>
          <div className="font-display text-3xl font-semibold text-navy-900">{formatNumber(total)}</div>
          <div className="space-y-2 pt-2">
            {data.slice(0, 5).map((item, index) => (
              <div key={item.name} className="flex items-center justify-between gap-2 text-xs">
                <span className="flex min-w-0 items-center gap-2 text-slate-600">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: palette[index % palette.length] }}
                  />
                  <span className="truncate">{item.name}</span>
                </span>
                <span className="font-semibold text-navy-900">{formatNumber(item.defects)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
