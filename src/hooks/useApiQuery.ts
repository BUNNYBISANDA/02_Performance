import { useEffect, useRef, useState } from "react";

type CacheEntry = {
  data: unknown;
  updatedAt: number;
};

type ApiQueryOptions<T> = {
  queryKey: string;
  queryFn: (signal: AbortSignal) => Promise<T>;
  enabled?: boolean;
  staleTime?: number;
  debounceMs?: number;
};

type ApiQueryState<T> = {
  data: T | null;
  isInitialLoading: boolean;
  isUpdating: boolean;
  error: string | null;
  retry: () => void;
};

const queryCache = new Map<string, CacheEntry>();

const isAbortError = (error: unknown) =>
  error instanceof DOMException && error.name === "AbortError";

export function useApiQuery<T>({
  queryKey,
  queryFn,
  enabled = true,
  staleTime = 120_000,
  debounceMs = 300,
}: ApiQueryOptions<T>): ApiQueryState<T> {
  const queryFnRef = useRef(queryFn);
  const [data, setData] = useState<T | null>(() => {
    const cached = queryCache.get(queryKey);
    return cached ? (cached.data as T) : null;
  });
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  queryFnRef.current = queryFn;

  useEffect(() => {
    if (!enabled) {
      setIsFetching(false);
      return;
    }

    const cached = queryCache.get(queryKey);
    const cacheIsFresh = Boolean(cached && Date.now() - cached.updatedAt < staleTime);

    if (cached) {
      setData(cached.data as T);
      setError(null);
      if (import.meta.env.DEV) {
        console.debug("[api-cache] hit", { queryKey, fresh: cacheIsFresh });
      }
    }

    if (cacheIsFresh) {
      setIsFetching(false);
      return;
    }

    const controller = new AbortController();
    setIsFetching(true);
    setError(null);

    const timer = window.setTimeout(() => {
      queryFnRef.current(controller.signal)
        .then((result) => {
          if (controller.signal.aborted) return;
          queryCache.set(queryKey, { data: result, updatedAt: Date.now() });
          setData(result);
        })
        .catch((requestError: unknown) => {
          if (controller.signal.aborted || isAbortError(requestError)) return;
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Unable to load dashboard data.",
          );
        })
        .finally(() => {
          if (!controller.signal.aborted) setIsFetching(false);
        });
    }, debounceMs);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [debounceMs, enabled, queryKey, retryKey, staleTime]);

  return {
    data,
    isInitialLoading: enabled && data === null && (isFetching || error === null),
    isUpdating: enabled && isFetching && data !== null,
    error,
    retry: () => {
      queryCache.delete(queryKey);
      setRetryKey((value) => value + 1);
    },
  };
}
