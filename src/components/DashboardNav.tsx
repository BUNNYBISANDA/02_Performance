import { BarChart3, LayoutDashboard, Microscope, Tags, TrendingUp } from "lucide-react";
import { NavLink } from "react-router-dom";

const navItems = [
  { to: "/executive-overview", label: "Executive Overview", icon: LayoutDashboard },
  { to: "/weekly-trends", label: "Weekly Trend Analysis", icon: TrendingUp },
  { to: "/defect-categories", label: "Defect Category Analysis", icon: Tags },
  { to: "/line-analysis", label: "Line-Level Analysis", icon: BarChart3 },
  { to: "/inspection-stage", label: "Inspection Stage Deep Dive", icon: Microscope },
];

export function DashboardNav() {
  return (
    <nav className="flex gap-2 overflow-x-auto pb-1">
      {navItems.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              [
                "inline-flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-xs font-semibold transition",
                isActive
                  ? "bg-white text-[#1f2a7a] shadow-sm"
                  : "bg-white/12 text-white ring-1 ring-white/20 hover:bg-white/20",
              ].join(" ")
            }
          >
            <Icon className="h-4 w-4" />
            {item.label}
          </NavLink>
        );
      })}
    </nav>
  );
}
