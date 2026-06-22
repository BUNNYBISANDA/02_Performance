import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { closePool } from "../db/pool.js";
import type { QualityFilters } from "../services/qualityFilters.js";
import {
  getDefectCategories,
  getFilterOptions,
  getLineAnalysis,
  getOverview,
  getStageDetail,
  getWeeklyTrend,
  inspectionStages,
} from "../services/qualityQueries.js";

/**
 * Generates the static JSON snapshot consumed by the frontend's VITE_DATA_MODE=static
 * mode (used on GitHub Pages, where there is no live backend). Reuses the exact same
 * service functions the Express routes call, so the JSON shape always matches what
 * the real API returns.
 */

const DEFAULT_FILTERS: QualityFilters = {
  customer: "Travis Mathew",
  factory: "G3",
  startDate: "2026-05-01",
  endDate: "2026-06-04",
  soNumbers: [],
  styles: [],
  lines: [],
  defectDescriptions: [],
  inspectionStages: [],
};

const STAGE_FILE_SUFFIX: Record<(typeof inspectionStages)[number], string> = {
  Inline: "inline",
  Endline: "endline",
  "Pre Final": "pre-final",
  Final: "final",
  "Third Party": "third-party",
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.resolve(__dirname, "../../../public/data");

const writeJsonFile = async (fileName: string, data: unknown) => {
  const filePath = path.join(OUTPUT_DIR, fileName);
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf-8");
  console.log(`Wrote ${path.relative(process.cwd(), filePath)}`);
};

const main = async () => {
  await mkdir(OUTPUT_DIR, { recursive: true });

  await writeJsonFile("filters.json", await getFilterOptions(DEFAULT_FILTERS));
  await writeJsonFile("overview.json", await getOverview(DEFAULT_FILTERS));
  await writeJsonFile("weekly-trend.json", await getWeeklyTrend(DEFAULT_FILTERS));
  await writeJsonFile("defect-categories.json", await getDefectCategories(DEFAULT_FILTERS));
  await writeJsonFile("line-analysis.json", await getLineAnalysis(DEFAULT_FILTERS));

  for (const stage of inspectionStages) {
    const detail = await getStageDetail(DEFAULT_FILTERS, stage);
    await writeJsonFile(`stage-detail-${STAGE_FILE_SUFFIX[stage]}.json`, detail);
  }

  console.log("Static data export complete.");
};

main()
  .catch((error) => {
    console.error("Static data export failed:", error);
    process.exitCode = 1;
  })
  .finally(() => closePool());
