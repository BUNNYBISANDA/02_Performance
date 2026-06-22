import {
  Bell,
  Gauge,
  LayoutDashboard,
  Timer,
  TrendingUp,
  Users,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import ceodaLogo from "../../assets/ceoda.webp";

type SidebarNavItem = {
  label: string;
  icon: LucideIcon;
  disabled?: boolean;
  onClick?: () => void;
};

type SidebarSection = {
  label: string;
  items: SidebarNavItem[];
};

export function CeodaDrawer({
  open,
  onClose,
  activeItem = "Dashboards",
}: {
  open: boolean;
  onClose: () => void;
  activeItem?: string;
}) {
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  const sections: SidebarSection[] = [
    {
      label: "Overview",
      items: [
        {
          label: "Dashboards",
          icon: LayoutDashboard,
          onClick: () => {
            navigate("/executive-overview");
            onClose();
          },
        },
        { label: "KPI Individual", icon: Gauge, disabled: true },
        { label: "Production Improvement", icon: TrendingUp, disabled: true },
        { label: "Sewing Downtime", icon: Timer, disabled: true },
        { label: "Efficiency", icon: Zap, disabled: true },
      ],
    },
    {
      label: "Admin",
      items: [{ label: "User Management", icon: Users, disabled: true }],
    },
  ];

  return (
    <>
      <div
        aria-hidden="true"
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-slate-950/55 transition-opacity duration-300 ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-label="CEODA platform navigation"
        className={`fixed left-0 top-0 z-50 flex h-full w-[min(85vw,300px)] flex-col border-r border-white/10 bg-[#0f1b2d] shadow-2xl transition-transform duration-300 ease-in-out sm:w-[280px] ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center gap-3 border-b border-white/10 px-4 py-5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white p-1 shadow-sm">
            <img src={ceodaLogo} alt="CEODA" className="h-full w-full object-contain" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-white">One Data Alliance</div>
            <div className="truncate text-[10px] font-bold uppercase tracking-wider text-slate-500">
              CEODA Platform
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close navigation menu"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-400 transition hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {sections.map((section) => (
            <div key={section.label} className="mb-5">
              <div className="mb-2 px-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                {section.label}
              </div>
              <div className="space-y-1">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = item.label === activeItem;
                  return (
                    <button
                      key={item.label}
                      type="button"
                      disabled={item.disabled}
                      onClick={item.onClick}
                      className={[
                        "flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-2.5 text-sm font-medium transition",
                        isActive
                          ? "bg-blue-600/90 text-white shadow-inner"
                          : item.disabled
                            ? "cursor-not-allowed text-slate-500"
                            : "text-slate-300 hover:bg-white/5 hover:text-white",
                      ].join(" ")}
                    >
                      <span className="flex items-center gap-3">
                        <Icon className="h-4 w-4 shrink-0" />
                        <span className="truncate">{item.label}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-white/10 px-3 py-4">
          <div className="relative rounded-lg bg-white/5 px-2.5 py-2.5 pr-8">
            <button
              type="button"
              aria-label="Notifications"
              className="absolute right-1.5 top-1.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-400 transition hover:bg-white/10 hover:text-white"
            >
              <Bell className="h-4 w-4" />
            </button>
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#7c2bd9] to-[#3154d4] text-xs font-bold text-white">
                SS
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold leading-snug text-white">Saladin Singhyatra</div>
                <div className="mt-0.5 text-[10.5px] leading-snug text-slate-400">
                  Assistant Data Analysts Department Manager - Center
                </div>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
