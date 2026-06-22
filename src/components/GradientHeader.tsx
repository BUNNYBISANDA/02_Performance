import { Menu, RefreshCcw } from "lucide-react";
import { ALL_VALUE } from "../context/DashboardFilterContext";
import { useQualityFilters } from "../lib/filter-context";
import { useDrawer } from "../lib/drawer-context";
import { DashboardNav } from "./DashboardNav";
import { ThemedSelect } from "./filters/ThemedSelect";
import { ExportMenu } from "./common/ExportMenu";

export function GradientHeader({
  title,
  eyebrow = "O2 Quality Command Center",
  pageExport,
}: {
  title?: string;
  eyebrow?: string;
  pageExport?: { targetId: string; fileName: string };
}) {
  const { filters, filterOptions, setFilter, latestRefreshDate, backendStatus } = useQualityFilters();
  const { openDrawer } = useDrawer();
  const resolvedTitle = title ?? (filters.customer ? `2026 ${filters.customer} Quality Performance` : "2026 Quality Performance");
  const refreshLabel = latestRefreshDate
    ? new Intl.DateTimeFormat("en-US", { month: "short", day: "2-digit", year: "numeric" }).format(new Date(latestRefreshDate))
    : "—";

  return (
    <header className="relative overflow-hidden bg-[linear-gradient(105deg,#7c2bd9_0%,#3154d4_48%,#00a9b7_100%)] text-white shadow-lift">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_10%,rgba(255,255,255,0.22),transparent_28%),linear-gradient(90deg,rgba(255,255,255,0.12)_1px,transparent_1px)] bg-[length:auto,42px_42px]" />
      <div className="relative w-full px-3 py-4 sm:px-4 xl:px-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={openDrawer}
              aria-label="Open navigation menu"
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-white/14 text-white ring-1 ring-white/20 transition hover:bg-white/22"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-cyan-100">{eyebrow}</div>
              <h1 className="mt-1 font-display text-2xl font-semibold tracking-normal sm:text-3xl">
                {resolvedTitle}
              </h1>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            {pageExport && (
              <ExportMenu
                targetId={pageExport.targetId}
                fileName={pageExport.fileName}
                allowPng={false}
                variant="dark"
                pageLevel
                pdfOrientation="landscape"
              />
            )}

            <ThemedSelect
              label="Customer"
              value={filters.customer}
              options={filterOptions.customers.map((customer) => ({ label: customer, value: customer }))}
              onChange={(value) => setFilter("customer", value)}
              className="w-full sm:w-[210px]"
            />

            <ThemedSelect
              label="Factory"
              value={filters.factory}
              options={[
                { label: "All", value: ALL_VALUE },
                ...filterOptions.factories.map((factory) => ({ label: factory, value: factory })),
              ]}
              onChange={(value) => setFilter("factory", value)}
              className="w-full sm:w-[125px]"
            />

            <div className="rounded-md bg-white/14 px-3 py-2 text-sm ring-1 ring-white/20">
              <div className="flex items-center gap-2">
                <RefreshCcw className="h-4 w-4 text-cyan-100" />
                <span className="text-xs font-semibold uppercase text-cyan-100">Latest Refresh Date</span>
              </div>
              <div className="mt-0.5 flex items-center gap-2 font-semibold">
                <span>{refreshLabel}</span>
                <span
                  className={`h-2 w-2 rounded-full ${
                    backendStatus === "connected"
                      ? "bg-emerald-300"
                      : backendStatus === "checking"
                        ? "bg-amber-300"
                        : "bg-rose-300"
                  }`}
                  title={`Backend ${backendStatus}`}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4">
          <DashboardNav />
        </div>
      </div>
    </header>
  );
}
