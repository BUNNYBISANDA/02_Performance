const configuredApiBaseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined)
  ?.trim()
  .replace(/\/$/, "");

export const API_BASE_URL = configuredApiBaseUrl || "http://localhost:4000/api";

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

export const getJson = async <T>(
  path: string,
  params?: QueryParams,
  options: RequestOptions = {},
): Promise<T> => {
  const url = `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}${buildQueryString(params)}`;
  const startedAt = performance.now();

  if (import.meta.env.DEV) {
    console.debug("[api] request", { endpoint: path, params: params ?? {} });
  }

  let response: Response;
  try {
    response = await fetch(url, { signal: options.signal });
  } catch (error) {
    if (options.signal?.aborted || (error instanceof DOMException && error.name === "AbortError")) {
      if (import.meta.env.DEV) {
        console.debug("[api] cancelled", {
          endpoint: path,
          durationMs: Math.round(performance.now() - startedAt),
        });
      }
      throw error;
    }

    throw new ApiError(
      `Unable to connect to backend at ${API_BASE_URL}.`,
      undefined,
      url,
    );
  }

  if (!response.ok) {
    let message = `API request failed with status ${response.status}.`;
    try {
      const body = (await response.json()) as { message?: string; error?: string };
      message = body.message ?? body.error ?? message;
    } catch {
      const text = await response.text().catch(() => "");
      if (text) message = text;
    }

    throw new ApiError(message, response.status, url);
  }

  if (import.meta.env.DEV) {
    console.debug("[api] response", {
      endpoint: path,
      status: response.status,
      durationMs: Math.round(performance.now() - startedAt),
    });
  }

  return response.json() as Promise<T>;
};
