import { Bar, BarChart, CartesianGrid, LabelList, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useState } from "react";
import { formatNumber } from "../lib/format";
import { INSPECTION_STAGES, STAGE_META } from "../lib/stageConfig";
import { ExportMenu } from "./common/ExportMenu";

export function GroupedDefectBarChart({ data }: { data: Record<string, string | number>[] }) {
  const [hoveredStage, setHoveredStage] = useState<(typeof INSPECTION_STAGES)[number] | null>(null);
  const height = Math.max(430, data.length * 42);

  return (
    <div id="defect-category-chart" className="rounded-lg border border-slate-200 bg-white p-4 shadow-card transition-[transform,box-shadow,border-color] duration-200 ease-out hover:-translate-y-0.5 hover:border-cyan-200 hover:shadow-lift">
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
            <Legend
              verticalAlign="top"
              align="left"
              wrapperStyle={{ paddingBottom: 10 }}
              content={() => (
                <div
                  className="flex flex-wrap items-center gap-x-5 gap-y-1.5 pb-2.5 text-sm font-semibold text-slate-700"
                  onMouseLeave={() => setHoveredStage(null)}
                >
                  {INSPECTION_STAGES.map((stage) => (
                    <button
                      key={stage}
                      type="button"
                      className="inline-flex items-center gap-2 transition-opacity duration-150"
                      style={{ opacity: hoveredStage && hoveredStage !== stage ? 0.28 : 1 }}
                      onMouseEnter={() => setHoveredStage(stage)}
                      onFocus={() => setHoveredStage(stage)}
                      onBlur={() => setHoveredStage(null)}
                      aria-label={`Highlight ${stage} Defect Qty`}
                    >
                      <span className="h-3 w-3 rounded-full" style={{ backgroundColor: STAGE_META[stage].color }} />
                      {stage} Defect Qty
                    </button>
                  ))}
                </div>
              )}
            />
            {INSPECTION_STAGES.map((stage) => {
              const isDimmed = hoveredStage !== null && hoveredStage !== stage;
              return (
                <Bar
                  key={stage}
                  dataKey={stage}
                  name={`${stage} Defect Qty`}
                  fill={STAGE_META[stage].color}
                  fillOpacity={isDimmed ? 0.25 : 1}
                  radius={[0, 4, 4, 0]}
                  barSize={9}
                  isAnimationActive={false}
                  style={{ transition: "fill-opacity 160ms ease" }}
                >
                  <LabelList
                    dataKey={stage}
                    position="right"
                    formatter={(value) => {
                      const numeric = Number(value ?? 0);
                      return numeric > 0 ? formatNumber(numeric) : "";
                    }}
                    fontSize={10}
                    opacity={isDimmed ? 0.25 : 1}
                  />
                </Bar>
              );
            })}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
