import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import { API_BASE_URL } from "../services/apiClient";
import { getFilters } from "../services/dashboardApi";
import type { FilterOptionsResponse } from "../types/api";
import type { FilterState, InspectionStage } from "../lib/types";

export const ALL_VALUE = "All";

type FrontendFilterOptions = {
  customers: string[];
  factories: string[];
  soNumbers: string[];
  styles: string[];
  lines: string[];
  weekNumbers: string[];
  defects: string[];
  inspectionCategories: InspectionStage[];
};

type BackendStatus = "checking" | "connected" | "offline";

type DashboardFilterContextValue = {
  filters: FilterState;
  filterOptions: FrontendFilterOptions;
  filtersReady: boolean;
  isLoadingFilters: boolean;
  filtersError: string | null;
  backendStatus: BackendStatus;
  apiBaseUrl: string;
  latestRefreshDate: string | null;
  setFilter: <K extends keyof FilterState>(key: K, value: FilterState[K]) => void;
  setFilters: Dispatch<SetStateAction<FilterState>>;
  resetFilters: () => void;
  resetSlicers: () => void;
  refetchFilters: () => void;
};

const createInitialFilters = (): FilterState => ({
  customer: "",
  factory: ALL_VALUE,
  dateFrom: "",
  dateTo: "",
  weekNumbers: [],
  soNumbers: [],
  styles: [],
  lines: [],
  defectDescriptions: [],
  inspectionCategories: [],
});

const emptyOptions: FrontendFilterOptions = {
  customers: [],
  factories: [],
  soNumbers: [],
  styles: [],
  lines: [],
  weekNumbers: [],
  defects: [],
  inspectionCategories: [],
};

let initialFiltersRequest: Promise<FilterOptionsResponse> | null = null;

const loadInitialFilters = (force = false) => {
  if (force) initialFiltersRequest = null;
  if (!initialFiltersRequest) {
    initialFiltersRequest = getFilters().catch((error) => {
      initialFiltersRequest = null;
      throw error;
    });
  }
  return initialFiltersRequest;
};

const sameArray = (left: readonly string[], right: readonly string[]) =>
  left.length === right.length && left.every((value, index) => value === right[index]);

const sameFilterValue = (left: FilterState[keyof FilterState], right: FilterState[keyof FilterState]) =>
  Array.isArray(left) && Array.isArray(right) ? sameArray(left, right) : left === right;

const toFrontendOptions = (options: FilterOptionsResponse): FrontendFilterOptions => ({
  customers: options.customers,
  factories: options.factories,
  soNumbers: options.soNumbers,
  styles: options.styles,
  lines: options.lines,
  weekNumbers: options.weekNumbers ?? [],
  defects: options.defectDescriptions,
  inspectionCategories: options.inspectionStages,
});

const resolveDefaults = (options: FilterOptionsResponse): FilterState => ({
  customer:
    options.customers.find((value) => value === options.defaultCustomer) ??
    options.customers[0] ??
    "",
  factory:
    options.factories.find((value) => value === options.defaultFactory) ??
    options.factories[0] ??
    ALL_VALUE,
  dateFrom: options.dateRange?.startDate ?? "",
  dateTo: options.dateRange?.endDate ?? "",
  weekNumbers: [],
  soNumbers: [],
  styles: [],
  lines: [],
  defectDescriptions: [],
  inspectionCategories: [],
});

const DashboardFilterContext = createContext<DashboardFilterContextValue | null>(null);

export function DashboardFilterProvider({ children }: { children: ReactNode }) {
  const [filters, setFilters] = useState<FilterState>(() => createInitialFilters());
  const [defaultFilters, setDefaultFilters] = useState<FilterState>(() => createInitialFilters());
  const [filterOptions, setFilterOptions] = useState<FrontendFilterOptions>(emptyOptions);
  const [filtersReady, setFiltersReady] = useState(false);
  const [isLoadingFilters, setIsLoadingFilters] = useState(true);
  const [filtersError, setFiltersError] = useState<string | null>(null);
  const [backendStatus, setBackendStatus] = useState<BackendStatus>("checking");
  const [latestRefreshDate, setLatestRefreshDate] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const initializedDefaults = useRef(false);

  useEffect(() => {
    let cancelled = false;

    setIsLoadingFilters(true);
    setFiltersError(null);

    loadInitialFilters(refreshKey > 0)
      .then((options) => {
        if (cancelled) return;

        const defaults = resolveDefaults(options);
        setFilterOptions(toFrontendOptions(options));
        setDefaultFilters(defaults);
        setLatestRefreshDate(options.latestRefreshDate ?? null);
        setBackendStatus("connected");

        if (!initializedDefaults.current) {
          initializedDefaults.current = true;
          setFilters(defaults);
        }

        setFiltersReady(true);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setFiltersError(error instanceof Error ? error.message : "Unable to load filter options.");
        setBackendStatus("offline");
        setFiltersReady(false);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingFilters(false);
      });

    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const setFilter = useCallback(<K extends keyof FilterState>(key: K, value: FilterState[K]) => {
    setFilters((current) => {
      if (sameFilterValue(current[key], value)) return current;

      const next = { ...current, [key]: value };
      if (key === "customer" || key === "factory" || key === "dateFrom" || key === "dateTo") {
        return {
          ...next,
          soNumbers: [],
          styles: [],
          lines: [],
          weekNumbers: [],
          defectDescriptions: [],
          inspectionCategories: [],
        };
      }
      return next;
    });
  }, []);

  const resetFilters = useCallback(() => setFilters(defaultFilters), [defaultFilters]);

  const resetSlicers = useCallback(() => {
    setFilters((current) => ({
      ...current,
      dateFrom: defaultFilters.dateFrom,
      dateTo: defaultFilters.dateTo,
      soNumbers: [],
      styles: [],
      lines: [],
      weekNumbers: [],
      defectDescriptions: [],
      inspectionCategories: [],
    }));
  }, [defaultFilters.dateFrom, defaultFilters.dateTo]);

  const refetchFilters = useCallback(() => setRefreshKey((value) => value + 1), []);

  const value = useMemo<DashboardFilterContextValue>(
    () => ({
      filters,
      filterOptions,
      filtersReady,
      isLoadingFilters,
      filtersError,
      backendStatus,
      apiBaseUrl: API_BASE_URL,
      latestRefreshDate,
      setFilter,
      setFilters,
      resetFilters,
      resetSlicers,
      refetchFilters,
    }),
    [
      backendStatus,
      filterOptions,
      filters,
      filtersError,
      filtersReady,
      isLoadingFilters,
      latestRefreshDate,
      refetchFilters,
      resetFilters,
      resetSlicers,
      setFilter,
    ],
  );

  return <DashboardFilterContext.Provider value={value}>{children}</DashboardFilterContext.Provider>;
}

export const useDashboardFilters = () => {
  const value = useContext(DashboardFilterContext);
  if (!value) throw new Error("useDashboardFilters must be used inside DashboardFilterProvider");
  return value;
};
