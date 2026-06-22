import type { InspectionStage, StatusLevel } from "./types";

export const INSPECTION_STAGES: InspectionStage[] = [
  "Inline",
  "Endline",
  "Pre Final",
  "Final",
  "Third Party",
];

export const STAGE_META: Record<
  InspectionStage,
  {
    color: string;
    softColor: string;
    target: number;
    label: string;
    denominatorLabel: string;
  }
> = {
  Inline: {
    color: "#00AEEF",
    softColor: "#DFF6FF",
    target: 3.5,
    label: "Inline",
    denominatorLabel: "Process checks",
  },
  Endline: {
    color: "#123C69",
    softColor: "#E7EFF8",
    target: 2.0,
    label: "Endline",
    denominatorLabel: "Endline inspected",
  },
  "Pre Final": {
    color: "#F28C28",
    softColor: "#FFF0DF",
    target: 1.2,
    label: "Pre Final",
    denominatorLabel: "Pre Final inspected",
  },
  Final: {
    color: "#7C3AED",
    softColor: "#F0E8FF",
    target: 0.7,
    label: "Final",
    denominatorLabel: "Final inspected",
  },
  "Third Party": {
    color: "#D946EF",
    softColor: "#FBE7FF",
    target: 0.5,
    label: "Third Party",
    denominatorLabel: "Third Party inspected",
  },
};

export const statusForRate = (
  stage: InspectionStage,
  rate: number,
): StatusLevel => {
  const target = STAGE_META[stage].target;
  if (rate <= target) return "Good";
  if (rate <= target * 1.35) return "Watch";
  return "Critical";
};

export const statusClass = (status: StatusLevel) => {
  if (status === "Good") return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if (status === "Watch") return "bg-amber-50 text-amber-700 ring-amber-200";
  return "bg-rose-50 text-rose-700 ring-rose-200";
};
