import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { DashboardLoading } from "./components/ApiState";
import { AppShell } from "./components/layout/AppShell";
import { DashboardFilterProvider } from "./context/DashboardFilterContext";

const ExecutiveOverview = lazy(() =>
  import("./pages/ExecutiveOverview").then((module) => ({ default: module.ExecutiveOverview })),
);
const WeeklyTrendAnalysis = lazy(() =>
  import("./pages/WeeklyTrendAnalysis").then((module) => ({ default: module.WeeklyTrendAnalysis })),
);
const DefectCategoryAnalysis = lazy(() =>
  import("./pages/DefectCategoryAnalysis").then((module) => ({ default: module.DefectCategoryAnalysis })),
);
const LineLevelAnalysis = lazy(() =>
  import("./pages/LineLevelAnalysis").then((module) => ({ default: module.LineLevelAnalysis })),
);
const InspectionStageDeepDivePage = lazy(() =>
  import("./pages/InspectionStageDeepDivePage").then((module) => ({
    default: module.InspectionStageDeepDivePage,
  })),
);

export default function App() {
  return (
    <DashboardFilterProvider>
      <AppShell>
        <Suspense fallback={<div className="p-4"><DashboardLoading label="Loading page..." /></div>}>
          <Routes>
            <Route path="/" element={<Navigate to="/executive-overview" replace />} />
            <Route path="/executive-overview" element={<ExecutiveOverview />} />
            <Route path="/weekly-trends" element={<WeeklyTrendAnalysis />} />
            <Route path="/defect-categories" element={<DefectCategoryAnalysis />} />
            <Route path="/line-analysis" element={<LineLevelAnalysis />} />
            <Route path="/inspection-stage" element={<InspectionStageDeepDivePage />} />
          </Routes>
        </Suspense>
      </AppShell>
    </DashboardFilterProvider>
  );
}
