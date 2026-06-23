import { INSPECTION_STAGES } from "./stageConfig";
import type { InspectionStage } from "./types";

export type StageTarget = {
  value: number;
  label: string;
  stages: InspectionStage[];
};

export const STAGE_TARGETS: Record<InspectionStage, number> = {
  Inline: 3,
  Endline: 2,
  "Pre Final": 2,
  Final: 1,
  "Third Party": 2,
};

const isInspectionStage = (value: string): value is InspectionStage =>
  (INSPECTION_STAGES as readonly string[]).includes(value);

const targetLabel = (stages: InspectionStage[], value: number) =>
  `${stages.join(" / ")} target ${value}%`;

const buildUniqueTargets = (stages: InspectionStage[]) => {
  const targetsByValue = new Map<number, InspectionStage[]>();

  stages.forEach((stage) => {
    const value = STAGE_TARGETS[stage];
    targetsByValue.set(value, [...(targetsByValue.get(value) ?? []), stage]);
  });

  return [...targetsByValue.entries()]
    .sort(([a], [b]) => b - a)
    .map(([value, targetStages]) => ({
      value,
      label: targetLabel(targetStages, value),
      stages: targetStages,
    }));
};

export const getVisibleStageTargets = (
  selectedInspectionCategories?: readonly string[],
): StageTarget[] => {
  const selectedStages = (selectedInspectionCategories ?? []).filter(isInspectionStage);

  if (
    selectedStages.length === 0 ||
    selectedInspectionCategories?.some((value) => value === "All")
  ) {
    return buildUniqueTargets(INSPECTION_STAGES);
  }

  return buildUniqueTargets(selectedStages);
};

