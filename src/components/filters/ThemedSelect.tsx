import { Check, ChevronDown } from "lucide-react";
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type ThemedSelectOption = {
  label: string;
  value: string;
};

type MenuPosition = {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
};

export function ThemedSelect({
  label,
  value,
  options,
  onChange,
  className = "",
}: {
  label: string;
  value: string;
  options: ThemedSelectOption[];
  onChange: (value: string) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();
  const selected = options.find((option) => option.value === value) ?? options[0];

  const updateMenuPosition = useCallback(() => {
    const rect = rootRef.current?.getBoundingClientRect();
    if (!rect) return;

    const viewportPadding = 8;
    const gap = 8;
    const naturalHeight = Math.min(280, options.length * 42 + 12);
    const availableWidth = Math.max(180, window.innerWidth - viewportPadding * 2);
    const width = Math.min(Math.max(rect.width, 170), availableWidth);
    const left = Math.min(
      Math.max(viewportPadding, rect.left),
      window.innerWidth - width - viewportPadding,
    );
    const spaceBelow = window.innerHeight - rect.bottom - viewportPadding - gap;
    const spaceAbove = rect.top - viewportPadding - gap;
    const openUp = spaceBelow < 160 && spaceAbove > spaceBelow;
    const availableHeight = openUp ? spaceAbove : spaceBelow;
    const maxHeight = Math.max(120, Math.min(naturalHeight, availableHeight));
    const top = openUp
      ? Math.max(viewportPadding, rect.top - maxHeight - gap)
      : Math.min(rect.bottom + gap, window.innerHeight - viewportPadding - maxHeight);

    setMenuPosition({ top, left, width, maxHeight });
  }, [options.length]);

  useLayoutEffect(() => {
    if (!open) return;
    updateMenuPosition();
  }, [open, updateMenuPosition]);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !panelRef.current?.contains(target)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const handleViewportChange = () => updateMenuPosition();

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleViewportChange, true);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleViewportChange, true);
    };
  }, [open, updateMenuPosition]);

  const selectValue = (nextValue: string) => {
    onChange(nextValue);
    setOpen(false);
  };

  const dropdownPanel =
    open && menuPosition && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={panelRef}
            id={listboxId}
            role="listbox"
            aria-label={label}
            style={{
              position: "fixed",
              top: menuPosition.top,
              left: menuPosition.left,
              width: menuPosition.width,
              maxHeight: menuPosition.maxHeight,
              zIndex: 9999,
            }}
            className="overflow-y-auto rounded-lg border border-white/10 bg-[#0f1b2d]/95 p-1.5 text-sm shadow-2xl ring-1 ring-cyan-200/10 backdrop-blur-xl"
          >
            {options.map((option) => {
              const isSelected = option.value === value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => selectValue(option.value)}
                  className={[
                    "flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left transition",
                    isSelected
                      ? "bg-blue-600 text-white shadow-inner"
                      : "text-slate-200 hover:bg-white/10 hover:text-white",
                  ].join(" ")}
                >
                  <span className="truncate font-semibold">{option.label}</span>
                  {isSelected && <Check className="h-4 w-4 shrink-0 text-cyan-100" />}
                </button>
              );
            })}
          </div>,
          document.body,
        )
      : null;

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setOpen(true);
          }
        }}
        className={[
          "group flex h-12 w-full items-center justify-between gap-3 rounded-lg border px-3 text-left text-white outline-none backdrop-blur-md transition",
          "border-white/20 bg-white/[0.10] shadow-[0_12px_30px_rgba(15,23,42,0.12)]",
          "hover:border-cyan-200/70 hover:bg-white/[0.16] hover:shadow-[0_14px_34px_rgba(0,169,183,0.18)]",
          "focus-visible:border-cyan-200 focus-visible:ring-2 focus-visible:ring-cyan-100/70",
          open ? "border-cyan-200/80 bg-white/[0.18] ring-1 ring-cyan-100/40" : "",
        ].join(" ")}
      >
        <span className="min-w-0">
          <span className="block text-[10px] font-bold uppercase leading-none tracking-wide text-cyan-100/90">
            {label}
          </span>
          <span className="mt-1 block truncate text-sm font-bold leading-tight text-white">
            {selected?.label ?? value}
          </span>
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-cyan-100 transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>
      {dropdownPanel}
    </div>
  );
}
