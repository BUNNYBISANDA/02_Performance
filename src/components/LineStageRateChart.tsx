import { Bar, BarChart, CartesianGrid, LabelList, Legend, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatRate } from "../lib/format";
import { INSPECTION_STAGES, STAGE_META } from "../lib/stageConfig";
import { ExportMenu } from "./common/ExportMenu";

export function LineStageRateChart({ data }: { data: Array<Record<string, string | number | null | undefined>> }) {
  return (
    <div id="line-level-chart" className="rounded-lg border border-slate-200 bg-white p-4 shadow-card">
      <div className="mb-3 flex items-start justify-between gap-3">
        <h2 className="font-display text-lg font-semibold text-slate-900">Line-Level Defect Rate Analysis</h2>
        <ExportMenu targetId="line-level-chart" fileName="O2_Line_Level_Defect_Rate_Analysis" />
      </div>
      <ResponsiveContainer width="100%" height={430}>
        <BarChart data={data} margin={{ top: 24, right: 28, bottom: 18, left: -10 }}>
          <CartesianGrid stroke="#d9e2ef" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="name" tickLine={false} axisLine={false} />
          <YAxis tickLine={false} axisLine={false} tickFormatter={(value) => `${Number(value).toFixed(0)}%`} />
          <Tooltip
            formatter={(value) => formatRate(Number(value))}
            contentStyle={{
              border: "1px solid #d9e2ef",
              borderRadius: 8,
              boxShadow: "0 14px 34px rgba(15, 45, 72, 0.12)",
            }}
          />
          <Legend verticalAlign="top" align="left" iconType="circle" wrapperStyle={{ paddingBottom: 10 }} />
          {INSPECTION_STAGES.map((stage, index) => (
            <ReferenceLine
              key={`${stage}-target`}
              y={STAGE_META[stage].target}
              stroke="#E11D48"
              strokeDasharray={index % 2 === 0 ? "6 5" : "2 5"}
              strokeOpacity={0.35}
            />
          ))}
          {INSPECTION_STAGES.map((stage) => (
            <Bar
              key={stage}
              dataKey={stage}
              name={`${stage} Defect Rate`}
              fill={STAGE_META[stage].color}
              radius={[4, 4, 0, 0]}
              barSize={13}
            >
              {stage === "Inline" && (
                <LabelList
                  dataKey={stage}
                  position="top"
                  formatter={(value) => {
                    const numeric = Number(value ?? 0);
                    return numeric >= 4 ? formatRate(numeric) : "";
                  }}
                  fontSize={10}
                  fill="#334155"
                />
              )}
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
