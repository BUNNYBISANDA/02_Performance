import { Bell, ChevronDown, Factory, RefreshCcw } from "lucide-react";
import { ALL_VALUE } from "../context/DashboardFilterContext";
import { useQualityFilters } from "../lib/filter-context";

export function Header() {
  const { filters, filterOptions, latestRefreshDate, setFilter } = useQualityFilters();
  const refreshLabel = latestRefreshDate
    ? new Intl.DateTimeFormat("en-US", { month: "short", day: "2-digit", year: "numeric" }).format(new Date(latestRefreshDate))
    : "—";

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/92 backdrop-blur">
      <div className="flex flex-col gap-4 px-4 py-4 sm:px-6 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase text-command-steel">
            <span>{[filters.customer, filters.factory].filter(Boolean).join(" ") || "All Quality Data"}</span>
            <span className="h-1 w-1 rounded-full bg-command-cyan" />
            <span>Manufacturing Quality</span>
          </div>
          <h1 className="mt-1 font-display text-2xl font-semibold text-navy-900 sm:text-3xl">
            O2 Quality Command Center
          </h1>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-navy-800">
            <Factory className="h-4 w-4 text-command-teal" />
            <span className="font-medium">Factory</span>
            <span className="relative">
              <select
                className="appearance-none bg-transparent pr-7 font-semibold outline-none"
                value={filters.factory}
                onChange={(event) => setFilter("factory", event.target.value)}
              >
                <option value={ALL_VALUE}>All</option>
                {filterOptions.factories.map((factory) => (
                  <option value={factory} key={factory}>
                    {factory}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-0 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            </span>
          </label>

          <div className="flex items-center gap-2 rounded-lg border border-cyan-100 bg-cyan-50 px-3 py-2 text-sm text-navy-800">
            <RefreshCcw className="h-4 w-4 text-command-cyan" />
            <span className="text-command-steel">Latest refresh</span>
            <span className="font-semibold">{refreshLabel}</span>
          </div>

          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-command-steel shadow-sm transition hover:border-command-cyan hover:text-command-cyan"
            aria-label="Notifications"
          >
            <Bell className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
