import { Bar, BarChart, CartesianGrid, LabelList, Legend, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useMemo, useState } from "react";
import { buildNicePercentTicks, formatPercentTick, formatRate } from "../lib/format";
import { INSPECTION_STAGES, STAGE_META } from "../lib/stageConfig";
import type { InspectionStage } from "../lib/types";
import { getVisibleStageTargets } from "../lib/stageTargets";
import { ExportMenu } from "./common/ExportMenu";

type LineStageRateChartProps = {
  data: Array<Record<string, string | number | null | undefined>>;
  selectedInspectionCategories?: readonly InspectionStage[];
};

export function LineStageRateChart({ data, selectedInspectionCategories = [] }: LineStageRateChartProps) {
  const [hoveredStage, setHoveredStage] = useState<InspectionStage | null>(null);

  const selectedTargets = useMemo(
    () => getVisibleStageTargets(selectedInspectionCategories),
    [selectedInspectionCategories],
  );

  const selectedStages = useMemo(
    () => new Set(selectedInspectionCategories),
    [selectedInspectionCategories],
  );

  const hasStageFilter = selectedInspectionCategories.length > 0;
  const visibleTargets = useMemo(() => {
    if (!hoveredStage) return selectedTargets;
    if (hasStageFilter && !selectedStages.has(hoveredStage)) return selectedTargets;

    const hoveredTarget = selectedTargets.find((target) => target.stages.includes(hoveredStage));
    return hoveredTarget
      ? [{ ...hoveredTarget, label: `${hoveredStage} target ${hoveredTarget.value}%` }]
      : selectedTargets;
  }, [hasStageFilter, hoveredStage, selectedTargets, selectedStages]);

  const { ticks: yAxisTicks, max: yAxisMax, decimals: yAxisDecimals } = useMemo(() => {
    const maxValue = data.reduce((max, row) => {
      const rowMax = INSPECTION_STAGES.reduce((stageMax, stage) => {
        const value = Number(row[stage] ?? 0);
        return Number.isFinite(value) ? Math.max(stageMax, value) : stageMax;
      }, 0);
      return Math.max(max, rowMax);
    }, 0);
    const maxTarget = visibleTargets.reduce((max, target) => Math.max(max, target.value), 0);
    return buildNicePercentTicks(Math.max(maxValue, maxTarget));
  }, [data, visibleTargets]);

  return (
    <div id="line-level-chart" className="rounded-lg border border-slate-200 bg-white p-4 shadow-card">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold text-slate-900">Line-Level Defect Rate Analysis</h2>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[11px] font-semibold text-green-800">
            {visibleTargets.map((target) => (
              <span key={target.label} className="inline-flex items-center gap-1.5">
                <span className="w-5 border-t border-dashed border-green-800" />
                {target.label}
              </span>
            ))}
          </div>
        </div>
        <ExportMenu targetId="line-level-chart" fileName="O2_Line_Level_Defect_Rate_Analysis" />
      </div>
      <ResponsiveContainer width="100%" height={430}>
        <BarChart data={data} margin={{ top: 24, right: 28, bottom: 18, left: -10 }}>
          <CartesianGrid stroke="#d9e2ef" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="name" tickLine={false} axisLine={false} />
          <YAxis
            tickLine={false}
            axisLine={false}
            domain={[0, yAxisMax]}
            ticks={yAxisTicks}
            tickFormatter={(value) => formatPercentTick(Number(value), yAxisDecimals)}
          />
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
                    aria-label={`Highlight ${stage} Defect Rate`}
                  >
                    <span className="h-3 w-3 rounded-full" style={{ backgroundColor: STAGE_META[stage].color }} />
                    {stage} Defect Rate
                  </button>
                ))}
              </div>
            )}
          />
          {visibleTargets.map((target) => (
            <ReferenceLine
              key={target.value}
              y={target.value}
              stroke="#166534"
              strokeDasharray="6 5"
              strokeOpacity={0.72}
              label={{
                value: `${target.value}% target`,
                position: "insideTopRight",
                fill: "#166534",
                fontSize: 10,
              }}
            />
          ))}
          {INSPECTION_STAGES.map((stage) => {
            const isDimmed = hoveredStage !== null && hoveredStage !== stage;
            return (
              <Bar
                key={stage}
                dataKey={stage}
                name={`${stage} Defect Rate`}
                fill={STAGE_META[stage].color}
                fillOpacity={isDimmed ? 0.25 : 1}
                radius={[4, 4, 0, 0]}
                barSize={13}
                style={{ transition: "fill-opacity 160ms ease" }}
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
                    opacity={isDimmed ? 0.25 : 1}
                  />
                )}
              </Bar>
            );
          })}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
