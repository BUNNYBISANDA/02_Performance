const PLACEHOLDER_BACKEND_URL_PATTERN = /YOUR_DEPLOYED_BACKEND_URL/i;

const rawApiBaseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined)
  ?.trim()
  .replace(/\/$/, "");

const isPlaceholderUrl = Boolean(rawApiBaseUrl && PLACEHOLDER_BACKEND_URL_PATTERN.test(rawApiBaseUrl));
const isConfigured = Boolean(rawApiBaseUrl) && !isPlaceholderUrl;

// In dev, fall back to the local backend so `npm run dev` works without a .env file.
// In production there is no safe fallback: defaulting to localhost would silently point
// the deployed site at the visitor's own machine instead of surfacing a real error.
export const BACKEND_CONFIGURED = isConfigured || import.meta.env.DEV;

export const API_BASE_URL = isConfigured
  ? rawApiBaseUrl!
  : import.meta.env.DEV
    ? "http://localhost:4000/api"
    : "(not configured)";

const BACKEND_NOT_CONFIGURED_MESSAGE = "Backend URL is not configured.";

// This app always reads live data. VITE_USE_MOCK_DATA exists only so deployments can
// assert mock mode is off; there is no mock implementation to switch to.
const mockDataRequested =
  (import.meta.env.VITE_USE_MOCK_DATA as string | undefined)?.trim().toLowerCase() === "true";
const MOCK_DATA_UNSUPPORTED_MESSAGE =
  "VITE_USE_MOCK_DATA=true was set, but this app has no mock data implementation. Set it to false and configure VITE_API_BASE_URL instead.";

export type DataMode = "api" | "static";

const rawDataMode = (import.meta.env.VITE_DATA_MODE as string | undefined)?.trim().toLowerCase();

// GitHub Pages can't run the Node.js backend, so production defaults to the static
// JSON snapshot unless explicitly switched back to "api" (e.g. once a real backend is
// deployed, set the VITE_DATA_MODE repository variable to "api" alongside
// VITE_API_BASE_URL). Local dev defaults to "api" to talk to the local backend.
export const DATA_MODE: DataMode =
  rawDataMode === "api" ? "api" : rawDataMode === "static" ? "static" : import.meta.env.DEV ? "api" : "static";

// import.meta.env.BASE_URL already matches whatever `base` is configured in
// vite.config.ts (e.g. "/O2_Performance/" in production, "/" in dev), so this self-corrects
// even if VITE_STATIC_DATA_BASE_URL is left unset or pointed at the wrong path.
const rawStaticDataBaseUrl = (import.meta.env.VITE_STATIC_DATA_BASE_URL as string | undefined)?.trim().replace(/\/$/, "");
export const STATIC_DATA_BASE_URL = rawStaticDataBaseUrl || `${import.meta.env.BASE_URL}data`.replace(/\/{2,}/g, "/");

if (DATA_MODE === "static") {
  // Per spec: this is a console-only note, not a dashboard UI element.
  console.info("Static demo data mode is active.");
}

// Must match slugifyCustomer() in backend/src/scripts/exportStaticData.ts.
const slugifyCustomer = (customer: string) =>
  customer.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

const DEFAULT_STATIC_CUSTOMER_SLUG = "travis-mathew";

const resolveCustomerSlug = (customer: unknown): string =>
  typeof customer === "string" && customer.trim() ? slugifyCustomer(customer) : DEFAULT_STATIC_CUSTOMER_SLUG;

const STATIC_CUSTOMER_FILE_BY_PATH: Record<string, string> = {
  "/overview": "overview.json",
  "/weekly-trend": "weekly-trend.json",
  "/defect-categories": "defect-categories.json",
  "/line-analysis": "line-analysis.json",
};

const STAGE_STATIC_FILE: Record<string, string> = {
  Inline: "stage-detail-inline.json",
  Endline: "stage-detail-endline.json",
  "Pre Final": "stage-detail-pre-final.json",
  Final: "stage-detail-final.json",
  "Third Party": "stage-detail-third-party.json",
};

type QueryValue = string | number | boolean | string[] | number[] | null | undefined;

export type QueryParams = Record<string, QueryValue>;

type RequestOptions = {
  signal?: AbortSignal;
};

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly url?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

const buildQueryString = (params?: QueryParams) => {
  if (!params) return "";

  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === null || value === undefined || value === "") return;

    if (Array.isArray(value)) {
      const cleanValues = value.map(String).filter((item) => item.trim().length > 0);
      if (cleanValues.length > 0) searchParams.set(key, cleanValues.join(","));
      return;
    }

    searchParams.set(key, String(value));
  });

  const query = searchParams.toString();
  return query ? `?${query}` : "";
};

// /filters has a customer-less global file (the static-mode dropdown is populated from
// it with no customer selected yet); every other endpoint is always customer-scoped, since
// each demo customer has its own exported snapshot under data/customers/<slug>/.
const resolveStaticFileName = (normalizedPath: string, params?: QueryParams): string | null => {
  if (normalizedPath === "/filters" && !params?.customer) return "filters.json";

  const customerSlug = resolveCustomerSlug(params?.customer);

  if (normalizedPath === "/filters") return `customers/${customerSlug}/filters.json`;

  if (normalizedPath === "/stage-detail") {
    const stage = typeof params?.stage === "string" ? params.stage : undefined;
    const stageFile = stage && STAGE_STATIC_FILE[stage];
    return stageFile ? `customers/${customerSlug}/${stageFile}` : null;
  }

  const fileName = STATIC_CUSTOMER_FILE_BY_PATH[normalizedPath];
  return fileName ? `customers/${customerSlug}/${fileName}` : null;
};

const fetchJson = async <T>(url: string, notConnectableMessage: string, signal?: AbortSignal): Promise<T> => {
  let response: Response;
  try {
    response = await fetch(url, { signal });
  } catch (error) {
    if (signal?.aborted || (error instanceof DOMException && error.name === "AbortError")) throw error;
    throw new ApiError(notConnectableMessage, undefined, url);
  }

  if (!response.ok) {
    let message = `Request failed with status ${response.status}.`;
    try {
      const body = (await response.json()) as { message?: string; error?: string };
      message = body.message ?? body.error ?? message;
    } catch {
      const text = await response.text().catch(() => "");
      if (text) message = text;
    }
    throw new ApiError(message, response.status, url);
  }

  return response.json() as Promise<T>;
};

export const getJson = async <T>(
  path: string,
  params?: QueryParams,
  options: RequestOptions = {},
): Promise<T> => {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  if (DATA_MODE === "static") {
    const customerLabel = typeof params?.customer === "string" && params.customer ? params.customer : "default (Travis Mathew)";
    const fileName = resolveStaticFileName(normalizedPath, params);
    if (!fileName) {
      const message = `No static demo data file is mapped for ${normalizedPath}.`;
      console.error(`[static-data] ${message}`);
      throw new ApiError(message);
    }

    const url = `${STATIC_DATA_BASE_URL}/${fileName}`;
    if (import.meta.env.DEV) console.debug("[static-data] request", { endpoint: normalizedPath, customer: customerLabel, url });

    try {
      // Never substitutes another customer's file on failure — a missing/404 snapshot
      // surfaces as a clear error instead of silently showing the wrong customer's data.
      return await fetchJson<T>(url, `Unable to load static demo data for ${customerLabel} (${fileName}).`, options.signal);
    } catch (error) {
      if (!options.signal?.aborted) {
        console.error(`[static-data] Failed to load ${url} for customer "${customerLabel}".`, error);
      }
      throw error;
    }
  }

  if (mockDataRequested) throw new ApiError(MOCK_DATA_UNSUPPORTED_MESSAGE);
  if (!BACKEND_CONFIGURED) throw new ApiError(BACKEND_NOT_CONFIGURED_MESSAGE);

  const url = `${API_BASE_URL}${normalizedPath}${buildQueryString(params)}`;
  const startedAt = performance.now();

  if (import.meta.env.DEV) console.debug("[api] request", { endpoint: path, params: params ?? {} });

  const result = await fetchJson<T>(url, `Unable to connect to backend at ${API_BASE_URL}.`, options.signal);

  if (import.meta.env.DEV) {
    console.debug("[api] response", { endpoint: path, durationMs: Math.round(performance.now() - startedAt) });
  }

  return result;
};
