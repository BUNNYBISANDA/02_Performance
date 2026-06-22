import { Bar, BarChart, CartesianGrid, LabelList, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatNumber } from "../lib/format";
import { INSPECTION_STAGES, STAGE_META } from "../lib/stageConfig";
import { ExportMenu } from "./common/ExportMenu";

export function GroupedDefectBarChart({ data }: { data: Record<string, string | number>[] }) {
  const height = Math.max(430, data.length * 42);

  return (
    <div id="defect-category-chart" className="rounded-lg border border-slate-200 bg-white p-4 shadow-card">
      <div className="mb-3 flex items-start justify-between gap-3">
        <h2 className="font-display text-lg font-semibold text-slate-900">
          Top Defect Categories by Inspection Stage
        </h2>
        <ExportMenu targetId="defect-category-chart" fileName="O2_Top_Defect_Categories" />
      </div>
      <div data-export-expandable="true" className="max-h-[470px] overflow-y-auto pr-1">
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={data} layout="vertical" margin={{ top: 22, right: 48, bottom: 8, left: 142 }}>
            <CartesianGrid stroke="#d9e2ef" strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" tickLine={false} axisLine={false} tickFormatter={(value) => formatNumber(Number(value))} />
            <YAxis type="category" dataKey="name" width={160} tickLine={false} axisLine={false} interval={0} />
            <Tooltip
              formatter={(value) => formatNumber(Number(value))}
              contentStyle={{
                border: "1px solid #d9e2ef",
                borderRadius: 8,
                boxShadow: "0 14px 34px rgba(15, 45, 72, 0.12)",
              }}
            />
            <Legend verticalAlign="top" align="left" iconType="circle" wrapperStyle={{ paddingBottom: 10 }} />
            {INSPECTION_STAGES.map((stage) => (
              <Bar
                key={stage}
                dataKey={stage}
                name={`${stage} Defect Qty`}
                fill={STAGE_META[stage].color}
                radius={[0, 4, 4, 0]}
                barSize={9}
                isAnimationActive={false}
              >
                <LabelList
                  dataKey={stage}
                  position="right"
                  formatter={(value) => {
                    const numeric = Number(value ?? 0);
                    return numeric > 0 ? formatNumber(numeric) : "";
                  }}
                  fontSize={10}
                />
              </Bar>
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
