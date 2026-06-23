import type { ReactNode } from "react";
import { GradientHeader } from "./GradientHeader";
import { SlicerPanel } from "./SlicerPanel";

export function PowerBIPageShell({
  children,
  pageId,
  pageExportFileName,
  showWeekNumbers = false,
  showBottomAccent = true,
  contentClassName = "",
}: {
  children: ReactNode;
  pageId?: string;
  pageExportFileName?: string;
  showWeekNumbers?: boolean;
  showBottomAccent?: boolean;
  contentClassName?: string;
}) {
  return (
    <div id={pageId} data-export-page={pageId ? "true" : undefined} className="min-h-screen bg-[#f4f6fb]">
      <GradientHeader
        pageExport={pageId && pageExportFileName ? { targetId: pageId, fileName: pageExportFileName } : undefined}
      />
      <div
        className={`grid w-full gap-3 px-2 py-3 sm:px-3 xl:px-4 lg:grid-cols-[250px_minmax(0,1fr)] ${contentClassName}`}
      >
        <SlicerPanel showWeekNumbers={showWeekNumbers} />
        <main className="min-w-0">{children}</main>
      </div>
      {showBottomAccent && <div className="h-1 bg-[linear-gradient(90deg,#7c2bd9,#3154d4,#00a9b7)]" />}
    </div>
  );
}
