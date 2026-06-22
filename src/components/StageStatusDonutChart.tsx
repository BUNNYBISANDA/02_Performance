import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { formatNumber } from "../lib/format";
import { ExportMenu } from "./common/ExportMenu";

export function StageStatusDonutChart({
  title,
  data,
}: {
  title: string;
  data: Array<{ name: string; value: number; color: string }>;
}) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const defect = data[0]?.value ?? 0;

  return (
    <div id="stage-donut-chart" className="rounded-lg border border-slate-200 bg-white p-4 shadow-card">
      <div className="mb-3 flex items-start justify-between gap-3">
        <h2 className="font-display text-lg font-semibold text-slate-900">{title}</h2>
        <ExportMenu targetId="stage-donut-chart" fileName="O2_Stage_Status_Donut" />
      </div>
      <div className="relative">
        <ResponsiveContainer width="100%" height={310}>
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius="62%"
              outerRadius="86%"
              paddingAngle={2}
              stroke="#ffffff"
              strokeWidth={2}
            >
              {data.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value) => formatNumber(Number(value))}
              contentStyle={{
                border: "1px solid #d9e2ef",
                borderRadius: 8,
                boxShadow: "0 14px 34px rgba(15, 45, 72, 0.12)",
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <div className="text-xs font-bold uppercase text-slate-500">Defect Qty</div>
            <div className="font-display text-3xl font-semibold text-slate-900">{formatNumber(defect)}</div>
            <div className="text-xs text-slate-500">of {formatNumber(total)}</div>
          </div>
        </div>
      </div>
      <div className="mt-2 grid gap-2">
        {data.map((item) => (
          <div key={item.name} className="flex items-center justify-between gap-2 text-sm">
            <span className="flex min-w-0 items-center gap-2 text-slate-600">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
              <span className="truncate">{item.name}</span>
            </span>
            <span className="font-semibold text-slate-900">{formatNumber(item.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
