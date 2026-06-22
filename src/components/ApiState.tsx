import { Loader2, RefreshCcw, WifiOff } from "lucide-react";
import { API_BASE_URL } from "../services/apiClient";

export function DashboardLoading({ label = "Loading dashboard data..." }: { label?: string }) {
  return (
    <div className="flex min-h-[260px] items-center justify-center rounded-lg border border-slate-200 bg-white p-6 text-center shadow-card">
      <div>
        <Loader2 className="mx-auto h-7 w-7 animate-spin text-[#00AEEF]" />
        <div className="mt-3 text-sm font-semibold text-slate-800">{label}</div>
      </div>
    </div>
  );
}

export function DashboardError({
  onRetry,
  message = "Unable to load dashboard data. Please check backend connection.",
}: {
  onRetry: () => void;
  message?: string;
}) {
  return (
    <div className="flex min-h-[260px] items-center justify-center rounded-lg border border-rose-200 bg-white p-6 text-center shadow-card">
      <div className="max-w-md">
        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-lg bg-rose-50 text-rose-600">
          <WifiOff className="h-5 w-5" />
        </div>
        <div className="mt-3 text-sm font-semibold text-slate-900">{message}</div>
        <div className="mt-1 break-all text-xs text-slate-500">Backend URL: {API_BASE_URL}</div>
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 inline-flex items-center justify-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-[#00AEEF] hover:text-[#00AEEF]"
        >
          <RefreshCcw className="h-4 w-4" />
          Retry
        </button>
      </div>
    </div>
  );
}

export function DashboardUpdateStatus({
  isUpdating,
  error,
  onRetry,
}: {
  isUpdating: boolean;
  error: string | null;
  onRetry: () => void;
}) {
  if (!isUpdating && !error) return null;

  return (
    <div data-export-ignore="true" className="pointer-events-none fixed bottom-4 right-4 z-40">
      {error ? (
        <div className="pointer-events-auto flex items-center gap-3 rounded-md border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-700 shadow-lift">
          <span>Update failed.</span>
          <button type="button" onClick={onRetry} className="underline underline-offset-2">
            Retry
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-lift">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-[#00AEEF]" />
          Updating...
        </div>
      )}
    </div>
  );
}
