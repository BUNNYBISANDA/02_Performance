import { SearchX } from "lucide-react";

export function EmptyState({
  title = "No records match the selected filters.",
}: {
  title?: string;
}) {
  return (
    <div className="flex min-h-[260px] items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center shadow-card">
      <div>
        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
          <SearchX className="h-5 w-5" />
        </div>
        <div className="mt-3 text-sm font-semibold text-slate-800">{title}</div>
        <div className="mt-1 text-xs text-slate-500">Adjust or clear slicers to restore dashboard data.</div>
      </div>
    </div>
  );
}
