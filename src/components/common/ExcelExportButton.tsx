import { FileSpreadsheet, Loader2 } from "lucide-react";
import { useState } from "react";
import { exportTableToExcel, type ExcelColumn, type ExcelExportOptions } from "../../utils/exportExcel";

type Props = {
  fileName: string;
  sheetName: string;
  title: string;
  subtitle?: string;
  filters?: ExcelExportOptions["filters"];
  columns: ExcelColumn[];
  rows: Record<string, unknown>[];
  totalsRow?: Record<string, unknown>;
  disabled?: boolean;
};

export function ExcelExportButton({
  fileName,
  sheetName,
  title,
  subtitle,
  filters,
  columns,
  rows,
  totalsRow,
  disabled = false,
}: Props) {
  const [isExporting, setIsExporting] = useState(false);
  const hasRows = rows.length > 0;
  const isDisabled = disabled || !hasRows || isExporting;

  const handleExport = async () => {
    if (isDisabled) return;
    setIsExporting(true);

    try {
      await exportTableToExcel({ fileName, sheetName, title, subtitle, filters, columns, rows, totalsRow });
    } catch (error) {
      if (import.meta.env.DEV) console.error("Excel export failed", error);
      window.alert("Excel export failed. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <button
      type="button"
      onClick={() => void handleExport()}
      disabled={isDisabled}
      title={hasRows ? "Export full table to Excel" : "No table data to export"}
      className="flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-600 transition hover:border-[#00AEEF] hover:text-[#008ebf] disabled:cursor-not-allowed disabled:opacity-50"
    >
      {isExporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileSpreadsheet className="h-3.5 w-3.5" />}
      <span>{isExporting ? "Exporting" : "Export Excel"}</span>
    </button>
  );
}
