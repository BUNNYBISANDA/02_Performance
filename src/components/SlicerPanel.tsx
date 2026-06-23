import { RotateCcw, SlidersHorizontal } from "lucide-react";
import { MultiSelectFilter } from "./filters/MultiSelectFilter";
import { useQualityFilters } from "../lib/filter-context";
import type { FilterState } from "../lib/types";

export function SlicerPanel({
  showWeekNumbers = false,
}: {
  showWeekNumbers?: boolean;
}) {
  const { filters, filterOptions, isLoadingFilters, filtersError, setFilter, resetSlicers, refetchFilters } = useQualityFilters();

  return (
    <aside className="rounded-lg border border-slate-200 bg-white p-3 shadow-card lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto">
      <div className="mb-3 flex items-center justify-between gap-2 border-b border-slate-200 pb-3">
        <div className="flex items-center gap-2 text-sm font-bold text-[#1f2a7a]">
          <SlidersHorizontal className="h-4 w-4 text-[#00AEEF]" />
          Slicers
        </div>
        <button
          type="button"
          onClick={resetSlicers}
          className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 transition hover:border-[#00AEEF] hover:text-[#00AEEF]"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Clear all
        </button>
      </div>

      <div className="space-y-3">
        {filtersError && (
          <button
            type="button"
            onClick={refetchFilters}
            className="w-full rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-left text-xs font-semibold text-rose-700"
          >
            Unable to load filters. Retry
          </button>
        )}
        {isLoadingFilters && !filtersError && (
          <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-500">
            Loading filters...
          </div>
        )}
        <div>
          <span className="mb-1 block text-[11px] font-bold uppercase text-slate-500">Duration Date</span>
          <div className="grid gap-2">
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(event) => setFilter("dateFrom", event.target.value)}
              className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-[#00AEEF] focus:ring-2 focus:ring-cyan-100"
            />
            <input
              type="date"
              value={filters.dateTo}
              onChange={(event) => setFilter("dateTo", event.target.value)}
              className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-[#00AEEF] focus:ring-2 focus:ring-cyan-100"
            />
          </div>
        </div>

        {showWeekNumbers && (
          <MultiSelectFilter
            label="Week Number"
            selectedValues={filters.weekNumbers}
            options={filterOptions.weekNumbers}
            onChange={(value) => setFilter("weekNumbers", value)}
          />
        )}

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
        <MultiSelectFilter
          label="Inspection Category"
          selectedValues={filters.inspectionCategories}
          options={filterOptions.inspectionCategories}
          onChange={(value) =>
            setFilter("inspectionCategories", value as FilterState["inspectionCategories"])
          }
        />
      </div>
    </aside>
  );
}
