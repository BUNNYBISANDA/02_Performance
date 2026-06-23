import { INSPECTION_STAGES } from "./stageConfig";
import type { InspectionStage } from "./types";

export type StageBaseline = {
  value: number;
  label: string;
  stages: InspectionStage[];
};

export const STAGE_BASELINES: Record<InspectionStage, number> = {
  Inline: 3,
  Endline: 2,
  "Pre Final": 2,
  Final: 1,
  "Third Party": 2,
};

const isInspectionStage = (value: string): value is InspectionStage =>
  (INSPECTION_STAGES as readonly string[]).includes(value);

const baselineLabel = (stages: InspectionStage[], value: number) =>
  `${stages.join(" / ")} baseline ${value}%`;

const buildUniqueBaselines = (stages: InspectionStage[]) => {
  const baselinesByValue = new Map<number, InspectionStage[]>();

  stages.forEach((stage) => {
    const value = STAGE_BASELINES[stage];
    baselinesByValue.set(value, [...(baselinesByValue.get(value) ?? []), stage]);
  });

  return [...baselinesByValue.entries()]
    .sort(([a], [b]) => b - a)
    .map(([value, baselineStages]) => ({
      value,
      label: baselineLabel(baselineStages, value),
      stages: baselineStages,
    }));
};

export const getVisibleStageBaselines = (
  selectedInspectionCategories?: readonly string[],
): StageBaseline[] => {
  const selectedStages = (selectedInspectionCategories ?? []).filter(isInspectionStage);

  if (
    selectedStages.length === 0 ||
    selectedInspectionCategories?.some((value) => value === "All")
  ) {
    return buildUniqueBaselines(INSPECTION_STAGES);
  }

  return buildUniqueBaselines(selectedStages);
};

