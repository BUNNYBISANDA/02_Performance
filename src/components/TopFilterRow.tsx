import { RotateCcw } from "lucide-react";
import { MultiSelectFilter } from "./filters/MultiSelectFilter";
import { useQualityFilters } from "../lib/filter-context";
import { INSPECTION_STAGES } from "../lib/stageConfig";
import type { InspectionStage } from "../lib/types";

export function TopFilterRow({
  stage,
  onStageChange,
}: {
  stage: InspectionStage;
  onStageChange: (stage: InspectionStage) => void;
}) {
  const { filters, filterOptions, setFilter, resetSlicers } = useQualityFilters();

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-card">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1.1fr_0.8fr_1fr_1fr_1fr_1.15fr_1fr_auto]">
        <label>
          <span className="mb-1 block text-[11px] font-bold uppercase text-slate-500">Duration Date</span>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(event) => setFilter("dateFrom", event.target.value)}
              className="w-full rounded-md border border-slate-200 bg-white px-2 py-2 text-sm text-slate-800 outline-none focus:border-[#00AEEF]"
            />
            <input
              type="date"
              value={filters.dateTo}
              onChange={(event) => setFilter("dateTo", event.target.value)}
              className="w-full rounded-md border border-slate-200 bg-white px-2 py-2 text-sm text-slate-800 outline-none focus:border-[#00AEEF]"
            />
          </div>
        </label>
        <MultiSelectFilter
          label="Week Number"
          selectedValues={filters.weekNumbers}
          options={filterOptions.weekNumbers}
          onChange={(value) => setFilter("weekNumbers", value)}
        />
        <MultiSelectFilter
          label="SO Number"
          selectedValues={filters.soNumbers}
          options={filterOptions.soNumbers}
          onChange={(value) => setFilter("soNumbers", value)}
        />
        <MultiSelectFilter
          label="Style"
          selectedValues={filters.styles}
          options={filterOptions.styles}
          onChange={(value) => setFilter("styles", value)}
        />
        <MultiSelectFilter
          label="Line Number"
          selectedValues={filters.lines}
          options={filterOptions.lines}
          onChange={(value) => setFilter("lines", value)}
        />
        <MultiSelectFilter
          label="Defect Description"
          selectedValues={filters.defectDescriptions}
          options={filterOptions.defects}
          onChange={(value) => setFilter("defectDescriptions", value)}
        />
        {/* Stage Deep Dive uses this page-level selector as the source of truth for stage visuals. */}
        <label className="min-w-0">
          <span className="mb-1 block text-[11px] font-bold uppercase text-slate-500">Inspection Stage</span>
          <select
            className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-[#00AEEF] focus:ring-2 focus:ring-cyan-100"
            value={stage}
            onChange={(event) => onStageChange(event.target.value as InspectionStage)}
          >
            {INSPECTION_STAGES.map((option) => (
              <option value={option} key={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={() => {
            resetSlicers();
            onStageChange("Inline");
          }}
          className="mt-5 inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-200 px-3 text-sm font-semibold text-slate-700 transition hover:border-[#00AEEF] hover:text-[#00AEEF] xl:mt-auto"
        >
          <RotateCcw className="h-4 w-4" />
          Clear
        </button>
      </div>
    </section>
  );
}
