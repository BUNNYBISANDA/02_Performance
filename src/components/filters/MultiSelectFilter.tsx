import { Check, ChevronDown, Search, X } from "lucide-react";
import { useMemo, useState } from "react";

export function MultiSelectFilter({
  label,
  options,
  selectedValues,
  onChange,
  placeholder = "All",
}: {
  label: string;
  options: string[];
  selectedValues: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
}) {
  const [query, setQuery] = useState("");

  const filteredOptions = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return options;
    return options.filter((option) => option.toLowerCase().includes(normalized));
  }, [options, query]);

  const displayValue =
    selectedValues.length === 0
      ? placeholder
      : selectedValues.length === 1
        ? selectedValues[0]
        : `${selectedValues.length} selected`;

  const toggleValue = (value: string) => {
    onChange(
      selectedValues.includes(value)
        ? selectedValues.filter((item) => item !== value)
        : [...selectedValues, value],
    );
  };

  return (
    <details className="group relative">
      <summary className="list-none">
        <span className="mb-1 block text-[11px] font-bold uppercase text-slate-500">{label}</span>
        <span className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition hover:border-[#00AEEF] group-open:border-[#00AEEF] group-open:ring-2 group-open:ring-cyan-100">
          <span className={selectedValues.length === 0 ? "text-slate-500" : "truncate font-medium text-slate-900"}>
            {displayValue}
          </span>
          <span className="flex items-center gap-1">
            {selectedValues.length > 0 && (
              <button
                type="button"
                aria-label={`Clear ${label}`}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onChange([]);
                }}
                className="rounded p-0.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
            <ChevronDown className="h-4 w-4 text-slate-400 transition group-open:rotate-180" />
          </span>
        </span>
      </summary>

      <div className="absolute left-0 right-0 z-30 mt-1 overflow-hidden rounded-md border border-slate-200 bg-white shadow-lift">
        <div className="border-b border-slate-100 p-2">
          <div className="flex items-center gap-2 rounded-md bg-slate-50 px-2 py-1.5">
            <Search className="h-3.5 w-3.5 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search"
              className="min-w-0 flex-1 bg-transparent text-xs text-slate-800 outline-none"
            />
          </div>
          <div className="mt-2 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => onChange(options)}
              className="text-xs font-semibold text-[#1E90FF] transition hover:text-[#1428A0]"
            >
              Select all
            </button>
            <button
              type="button"
              onClick={() => onChange([])}
              className="text-xs font-semibold text-slate-500 transition hover:text-slate-900"
            >
              Clear
            </button>
          </div>
        </div>

        <div className="max-h-44 overflow-y-auto py-1">
          {filteredOptions.length === 0 ? (
            <div className="px-3 py-2 text-xs text-slate-500">No options</div>
          ) : (
            filteredOptions.map((option) => {
              const checked = selectedValues.includes(option);
              return (
                <label
                  key={option}
                  className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleValue(option)}
                    className="h-3.5 w-3.5 rounded border-slate-300 text-[#1E90FF] focus:ring-[#1E90FF]"
                  />
                  <span className="min-w-0 flex-1 truncate">{option}</span>
                  {checked && <Check className="h-3.5 w-3.5 shrink-0 text-[#1E90FF]" />}
                </label>
              );
            })
          )}
        </div>
      </div>
    </details>
  );
}
