export type ExportMode = "visible" | "full";

export type ExportOptions = {
  mode?: ExportMode;
  pixelRatio?: number;
};

export type PdfOptions = ExportOptions & {
  orientation?: "auto" | "landscape" | "portrait";
  format?: "a4" | "letter";
  marginMm?: number;
};

type ExpandedAreaSnapshot = {
  element: HTMLElement;
  styleAttribute: string | null;
  scrollTop: number;
  scrollLeft: number;
};

type CapturedElement = {
  dataUrl: string;
  sourceWidth: number;
  sourceHeight: number;
  rowBreaks: number[];
};

const WHITE = "#ffffff";
const FULL_EXPORT_DELAY_MS = 200;

const getLocalDate = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const getExportFileName = (
  baseName: string,
  extension: "png" | "pdf",
) => {
  const withoutExtension = baseName.replace(/\.(png|pdf)$/i, "");
  const withoutExistingDate = withoutExtension.replace(/_\d{4}-\d{2}-\d{2}$/, "");
  const safeBaseName = withoutExistingDate
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");

  return `${safeBaseName || "O2_Dashboard_Export"}_${getLocalDate()}.${extension}`;
};

const getExportElement = (elementId: string) => {
  const element = document.getElementById(elementId);
  if (!element) throw new Error(`Export target not found: ${elementId}`);
  return element;
};

const waitForFonts = async () => {
  if ("fonts" in document) await document.fonts.ready;
};

const waitForLayout = async (delayMs = 0) => {
  if (delayMs > 0) {
    await new Promise<void>((resolve) => window.setTimeout(resolve, delayMs));
  }
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
};

const shouldIncludeNode = (node: HTMLElement) =>
  node.dataset?.exportIgnore !== "true";

const expandMarkedAreas = (target: HTMLElement): ExpandedAreaSnapshot[] => {
  const areas = [
    ...(target.matches("[data-export-expandable='true']") ? [target] : []),
    ...target.querySelectorAll<HTMLElement>("[data-export-expandable='true']"),
  ];

  return areas.map((element) => {
    const snapshot: ExpandedAreaSnapshot = {
      element,
      styleAttribute: element.getAttribute("style"),
      scrollTop: element.scrollTop,
      scrollLeft: element.scrollLeft,
    };

    element.scrollTop = 0;
    element.scrollLeft = 0;
    element.style.setProperty("overflow", "visible", "important");
    element.style.setProperty("overflow-x", "visible", "important");
    element.style.setProperty("overflow-y", "visible", "important");
    element.style.setProperty("max-height", "none", "important");
    element.style.setProperty("height", "auto", "important");
    return snapshot;
  });
};

const restoreExpandedAreas = (snapshots: ExpandedAreaSnapshot[]) => {
  [...snapshots].reverse().forEach(({ element, styleAttribute, scrollTop, scrollLeft }) => {
    if (styleAttribute === null) {
      element.removeAttribute("style");
    } else {
      element.setAttribute("style", styleAttribute);
    }
    element.scrollTop = scrollTop;
    element.scrollLeft = scrollLeft;
  });
};

const getRowBreaks = (target: HTMLElement, targetTop: number, sourceHeight: number) =>
  [...target.querySelectorAll<HTMLElement>("[data-export-expandable='true'] tr")]
    .map((row) => row.getBoundingClientRect().bottom - targetTop)
    .filter((position) => position > 0 && position < sourceHeight)
    .sort((left, right) => left - right);

const captureElement = async (
  element: HTMLElement,
  { mode = "visible", pixelRatio = 2 }: ExportOptions,
): Promise<CapturedElement> => {
  await waitForFonts();
  const snapshots = mode === "full" ? expandMarkedAreas(element) : [];

  try {
    await waitForLayout(mode === "full" ? FULL_EXPORT_DELAY_MS : 0);
    const elementRect = element.getBoundingClientRect();
    const sourceWidth = Math.max(element.scrollWidth, element.clientWidth, Math.ceil(elementRect.width), 1);
    const sourceHeight = Math.max(element.scrollHeight, element.clientHeight, Math.ceil(elementRect.height), 1);
    const rowBreaks = mode === "full" ? getRowBreaks(element, elementRect.top, sourceHeight) : [];
    const { toPng } = await import("html-to-image");
    const dataUrl = await toPng(element, {
      backgroundColor: WHITE,
      cacheBust: true,
      pixelRatio,
      filter: shouldIncludeNode,
      width: sourceWidth,
      height: sourceHeight,
    });

    return { dataUrl, sourceWidth, sourceHeight, rowBreaks };
  } finally {
    if (snapshots.length > 0) {
      restoreExpandedAreas(snapshots);
      await waitForLayout();
    }
  }
};

const downloadDataUrl = (dataUrl: string, fileName: string) => {
  const link = document.createElement("a");
  link.download = fileName;
  link.href = dataUrl;
  link.click();
};

const loadImage = (dataUrl: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Unable to prepare captured image for PDF export."));
    image.src = dataUrl;
  });

const fillPageWhite = (pdf: import("jspdf").jsPDF, width: number, height: number) => {
  pdf.setFillColor(255, 255, 255);
  pdf.rect(0, 0, width, height, "F");
};

const findSliceEnd = (
  start: number,
  idealEnd: number,
  sourceHeight: number,
  rowBreaks: number[],
) => {
  if (idealEnd >= sourceHeight) return sourceHeight;

  const minimumUsefulEnd = start + (idealEnd - start) * 0.55;
  const candidateBoundaries = rowBreaks
    .filter((position) => position >= minimumUsefulEnd && position <= idealEnd);
  const rowBoundary = candidateBoundaries[candidateBoundaries.length - 1];
  return rowBoundary ?? idealEnd;
};

export const exportElementAsPng = async (
  elementId: string,
  fileName: string,
  options: ExportOptions = {},
): Promise<void> => {
  const element = getExportElement(elementId);
  const capture = await captureElement(element, {
    mode: options.mode ?? "visible",
    pixelRatio: options.pixelRatio ?? 3,
  });
  downloadDataUrl(capture.dataUrl, getExportFileName(fileName, "png"));
};

export const exportElementAsPdf = async (
  elementId: string,
  fileName: string,
  options: PdfOptions = {},
): Promise<void> => {
  const element = getExportElement(elementId);
  const capture = await captureElement(element, {
    mode: options.mode ?? "visible",
    pixelRatio: options.pixelRatio ?? 2,
  });
  const requestedOrientation = options.orientation ?? "auto";
  const orientation = requestedOrientation === "auto"
    ? capture.sourceWidth / capture.sourceHeight >= 1.1
      ? "landscape"
      : "portrait"
    : requestedOrientation;
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({
    orientation,
    unit: "mm",
    format: options.format ?? "a4",
    compress: true,
  });

  const margin = options.marginMm ?? 8;
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const availableWidth = pageWidth - margin * 2;
  const availableHeight = pageHeight - margin * 2;
  const renderedHeight = (capture.sourceHeight / capture.sourceWidth) * availableWidth;

  if (renderedHeight <= availableHeight) {
    const scale = Math.min(availableWidth / capture.sourceWidth, availableHeight / capture.sourceHeight);
    const imageWidth = capture.sourceWidth * scale;
    const imageHeight = capture.sourceHeight * scale;
    fillPageWhite(pdf, pageWidth, pageHeight);
    pdf.addImage(
      capture.dataUrl,
      "PNG",
      (pageWidth - imageWidth) / 2,
      (pageHeight - imageHeight) / 2,
      imageWidth,
      imageHeight,
      undefined,
      "FAST",
    );
  } else {
    const image = await loadImage(capture.dataUrl);
    const maxSliceHeight = capture.sourceWidth * (availableHeight / availableWidth);
    const pixelScaleY = image.naturalHeight / capture.sourceHeight;
    let sliceStart = 0;
    let pageIndex = 0;

    while (sliceStart < capture.sourceHeight - 0.5) {
      const idealEnd = Math.min(sliceStart + maxSliceHeight, capture.sourceHeight);
      const sliceEnd = findSliceEnd(sliceStart, idealEnd, capture.sourceHeight, capture.rowBreaks);
      const sourcePixelY = Math.round(sliceStart * pixelScaleY);
      const sourcePixelEnd = Math.min(image.naturalHeight, Math.round(sliceEnd * pixelScaleY));
      const sourcePixelHeight = Math.max(1, sourcePixelEnd - sourcePixelY);
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = sourcePixelHeight;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Unable to prepare PDF page.");
      context.fillStyle = WHITE;
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(
        image,
        0,
        sourcePixelY,
        image.naturalWidth,
        sourcePixelHeight,
        0,
        0,
        image.naturalWidth,
        sourcePixelHeight,
      );

      if (pageIndex > 0) pdf.addPage();
      fillPageWhite(pdf, pageWidth, pageHeight);
      const sliceHeightMm = (sliceEnd - sliceStart) / capture.sourceWidth * availableWidth;
      pdf.addImage(
        canvas.toDataURL("image/png"),
        "PNG",
        margin,
        margin,
        availableWidth,
        sliceHeightMm,
        undefined,
        "FAST",
      );

      sliceStart = sliceEnd;
      pageIndex += 1;
    }
  }

  pdf.save(getExportFileName(fileName, "pdf"));
};

export const exportCurrentPageAsPdf = async (
  fileName: string,
  options: PdfOptions = {},
): Promise<void> => {
  const page = document.querySelector<HTMLElement>("[data-export-page='true']");
  if (!page?.id) throw new Error("Current dashboard page is not available for export.");
  await exportElementAsPdf(page.id, fileName, {
    ...options,
    orientation: options.orientation ?? "landscape",
    format: options.format ?? "a4",
  });
};
