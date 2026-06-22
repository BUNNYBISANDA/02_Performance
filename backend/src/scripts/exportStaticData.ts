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
 *
 * Exports one folder per demo customer under public/data/customers/<slug>/, plus one
 * global public/data/filters.json that lists just these customers for the static-mode
 * customer dropdown.
 */

const STATIC_CUSTOMERS = ["Travis Mathew", "lululemon", "Fanatics"] as const;
const START_DATE = "2026-01-01";
const END_DATE = "2026-06-30";
const PREFERRED_FACTORY = "G3";

const EMPTY_ARRAY_FILTERS = {
  soNumbers: [] as string[],
  styles: [] as string[],
  lines: [] as string[],
  defectDescriptions: [] as string[],
  inspectionStages: [] as string[],
};

const STAGE_FILE_SUFFIX: Record<(typeof inspectionStages)[number], string> = {
  Inline: "inline",
  Endline: "endline",
  "Pre Final": "pre-final",
  Final: "final",
  "Third Party": "third-party",
};

// Must match resolveCustomerSlug() in src/services/apiClient.ts.
const slugifyCustomer = (customer: string) =>
  customer.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, "../../../public/data");
const CUSTOMERS_DIR = path.join(DATA_DIR, "customers");

const writeJsonFile = async (filePath: string, data: unknown) => {
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf-8");
  console.log(`Wrote ${path.relative(process.cwd(), filePath)}`);
};

type CustomerScope = {
  customer: string;
  slug: string;
  filters: QualityFilters;
  /** "G3", or "ALL" when G3 had zero rows and the export uses every factory for this customer. */
  factoryUsed: string;
  rowCount: number;
};

/**
 * Decides the factory scope per customer instead of forcing G3: probes rowCount with
 * no factory filter, then with factory=G3. Only commits to G3 if it actually returns
 * rows for this customer+date range; otherwise exports with no factory filter so the
 * snapshot still has real, non-zero data.
 */
const resolveCustomerScope = async (customer: string): Promise<CustomerScope> => {
  const probeBase: QualityFilters = {
    ...EMPTY_ARRAY_FILTERS,
    startDate: START_DATE,
    endDate: END_DATE,
    customer,
  };

  const noFactoryResult = await getFilterOptions(probeBase);
  const totalRowCount = noFactoryResult.meta?.rowCount ?? 0;

  let factoryUsed = "ALL";
  let rowCount = totalRowCount;

  if (totalRowCount > 0 && (noFactoryResult.factories ?? []).includes(PREFERRED_FACTORY)) {
    const withFactoryResult = await getFilterOptions({ ...probeBase, factory: PREFERRED_FACTORY });
    const factoryRowCount = withFactoryResult.meta?.rowCount ?? 0;
    if (factoryRowCount > 0) {
      factoryUsed = PREFERRED_FACTORY;
      rowCount = factoryRowCount;
    }
  }

  return {
    customer,
    slug: slugifyCustomer(customer),
    filters: { ...probeBase, factory: factoryUsed === "ALL" ? undefined : factoryUsed },
    factoryUsed,
    rowCount,
  };
};

const exportCustomer = async (scope: CustomerScope) => {
  const customerDir = path.join(CUSTOMERS_DIR, scope.slug);
  await mkdir(customerDir, { recursive: true });

  if (scope.rowCount === 0) {
    console.warn(
      `WARNING: "${scope.customer}" has ZERO rows in ${START_DATE}..${END_DATE}. ` +
        `Writing empty-shaped placeholder JSON for this customer instead of fabricated data.`,
    );
  }

  await writeJsonFile(path.join(customerDir, "filters.json"), await getFilterOptions(scope.filters));
  await writeJsonFile(path.join(customerDir, "overview.json"), await getOverview(scope.filters));
  await writeJsonFile(path.join(customerDir, "weekly-trend.json"), await getWeeklyTrend(scope.filters));
  await writeJsonFile(path.join(customerDir, "defect-categories.json"), await getDefectCategories(scope.filters));
  await writeJsonFile(path.join(customerDir, "line-analysis.json"), await getLineAnalysis(scope.filters));

  for (const stage of inspectionStages) {
    const detail = await getStageDetail(scope.filters, stage);
    await writeJsonFile(path.join(customerDir, `stage-detail-${STAGE_FILE_SUFFIX[stage]}.json`), detail);
  }
};

const main = async () => {
  await mkdir(CUSTOMERS_DIR, { recursive: true });

  const scopes: CustomerScope[] = [];
  for (const customer of STATIC_CUSTOMERS) {
    scopes.push(await resolveCustomerScope(customer));
  }

  console.log("\nResolved per-customer factory scope:");
  scopes.forEach((scope) => {
    console.log(`  - ${scope.customer}: factory=${scope.factoryUsed}, rowCount=${scope.rowCount}`);
  });
  console.log();

  for (const scope of scopes) {
    await exportCustomer(scope);
  }

  // Global filters.json drives the static-mode customer dropdown: customers is hardcoded to
  // exactly the 3 demo customers above (regardless of how many other customers exist in the
  // database) since those are the only ones with a matching customers/<slug>/ export.
  const combinedFilters = await getFilterOptions({
    ...EMPTY_ARRAY_FILTERS,
    startDate: START_DATE,
    endDate: END_DATE,
  });
  await writeJsonFile(path.join(DATA_DIR, "filters.json"), {
    ...combinedFilters,
    customers: STATIC_CUSTOMERS,
    defaultCustomer: "Travis Mathew",
    minDate: START_DATE,
    maxDate: END_DATE,
    dateRange: { startDate: START_DATE, endDate: END_DATE },
  });

  console.log("Static data export complete.");
};

main()
  .catch((error) => {
    console.error("Static data export failed:", error);
    process.exitCode = 1;
  })
  .finally(() => closePool());
