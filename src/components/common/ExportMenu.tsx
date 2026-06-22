import {
  ChevronDown,
  Download,
  Eye,
  FileText,
  Image,
  Loader2,
  Maximize2,
} from "lucide-react";
import { useRef, useState, type ReactNode } from "react";
import {
  exportElementAsPdf,
  exportElementAsPng,
  type ExportMode,
  type PdfOptions,
} from "../../utils/exportVisuals";

type ExportFormat = "png" | "pdf";

function MenuOption({
  icon,
  label,
  disabled,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="flex w-full items-center gap-2 rounded px-2.5 py-2 text-left text-xs font-semibold text-slate-700 transition hover:bg-cyan-50 hover:text-[#008ebf] disabled:opacity-50"
    >
      {icon}
      {label}
    </button>
  );
}

export function ExportMenu({
  targetId,
  fileName,
  allowPng = true,
  allowPdf = true,
  allowVisiblePdf = false,
  variant = "light",
  pageLevel = false,
  pdfOrientation = "auto",
}: {
  targetId: string;
  fileName: string;
  allowPng?: boolean;
  allowPdf?: boolean;
  allowVisiblePdf?: boolean;
  variant?: "light" | "dark";
  pageLevel?: boolean;
  pdfOrientation?: PdfOptions["orientation"];
}) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const [isExporting, setIsExporting] = useState(false);

  const runExport = async (format: ExportFormat, mode: ExportMode = "visible") => {
    if (isExporting) return;
    if (detailsRef.current) detailsRef.current.open = false;
    setIsExporting(true);

    try {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      const modeFileName = mode === "full" ? `${fileName}_Full` : fileName;

      if (format === "png") {
        await exportElementAsPng(targetId, modeFileName, { mode });
      } else {
        await exportElementAsPdf(targetId, modeFileName, {
          mode,
          orientation: pdfOrientation,
        });
      }
    } catch (error) {
      if (import.meta.env.DEV) console.error("Dashboard export failed", error);
      window.alert("Export failed. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <details ref={detailsRef} data-export-ignore="true" className="group relative shrink-0">
      <summary
        aria-label="Open export options"
        className={[
          "flex h-8 cursor-pointer list-none items-center gap-1.5 rounded-md border px-2.5 text-xs font-semibold transition",
          variant === "dark"
            ? "border-white/25 bg-white/12 text-white hover:border-white/45 hover:bg-white/20"
            : "border-slate-200 bg-white text-slate-600 hover:border-[#00AEEF] hover:text-[#008ebf]",
          isExporting ? "pointer-events-none opacity-70" : "",
        ].join(" ")}
      >
        {isExporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
        <span>{isExporting ? "Exporting" : "Export"}</span>
        {!isExporting && <ChevronDown className="h-3 w-3 transition group-open:rotate-180" />}
      </summary>

      <div className="absolute right-0 z-[60] mt-1.5 min-w-48 overflow-hidden rounded-md border border-slate-200 bg-white p-1 shadow-lift">
        {allowPng && (
          <>
            <MenuOption
              icon={<Eye className="h-3.5 w-3.5" />}
              label="Export visible PNG"
              disabled={isExporting}
              onClick={() => void runExport("png", "visible")}
            />
            <MenuOption
              icon={<Image className="h-3.5 w-3.5" />}
              label="Export full PNG"
              disabled={isExporting}
              onClick={() => void runExport("png", "full")}
            />
          </>
        )}

        {allowPdf && pageLevel && (
          <>
            <MenuOption
              icon={<FileText className="h-3.5 w-3.5" />}
              label="Export current view PDF"
              disabled={isExporting}
              onClick={() => void runExport("pdf", "visible")}
            />
            <MenuOption
              icon={<Maximize2 className="h-3.5 w-3.5" />}
              label="Export full page PDF"
              disabled={isExporting}
              onClick={() => void runExport("pdf", "full")}
            />
          </>
        )}

        {allowPdf && !pageLevel && (
          <>
            {allowVisiblePdf && (
              <MenuOption
                icon={<Eye className="h-3.5 w-3.5" />}
                label="Export visible PDF"
                disabled={isExporting}
                onClick={() => void runExport("pdf", "visible")}
              />
            )}
            <MenuOption
              icon={<FileText className="h-3.5 w-3.5" />}
              label="Export full PDF"
              disabled={isExporting}
              onClick={() => void runExport("pdf", "full")}
            />
          </>
        )}
      </div>
    </details>
  );
}
