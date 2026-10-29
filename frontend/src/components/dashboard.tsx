"use client";

import { useState } from "react";
import {
  LayoutDashboard,
  Users,
  GitFork,
  BookOpen,
  GraduationCap,
  Zap,
  Menu,
  AlertTriangle,
  Settings,
  Sparkles,
  AlertCircle,
  ChevronLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Toast } from "@/components/ui/toast";
import { ScheduleProvider, useSchedule } from "@/lib/schedule-store";
import { Header } from "./header";
import { HealthBar } from "./health-bar";
import { Footer } from "./footer";
import { DisruptionDrawer } from "./disruption-drawer";
import { MasterTimetableView } from "./views/master-timetable";
import { FacultyView } from "./views/faculty";
import { GraphView } from "./views/graph";
import { CoursesView } from "./views/courses";
import { StudentsView } from "./views/students";
import { WizardView } from "./views/wizard";
import { Sidebar } from "./sidebar";

export type ActiveView = "master" | "faculty" | "graph" | "courses" | "students" | "wizard";

const VIEW_CONFIG = {
  master: { label: "Master Timetable", icon: LayoutDashboard, desc: "Drag-drop grid, auto-solve" },
  faculty: { label: "Faculty & Traversal", icon: Users, desc: "Paint availability, walking distance" },
  graph: { label: "DAG & Graduation", icon: GitFork, desc: "Prerequisite graph, term traversal" },
  courses: { label: "Cohort Demand", icon: BookOpen, desc: "Demand vs scheduled sections" },
  students: { label: "Student Audits", icon: GraduationCap, desc: "Conflict-free enrollment, progress" },
  wizard: { label: "Guided Wizard", icon: Zap, desc: "Step-by-step: Intake → Build → Review" },
} as const;

type Mode = "simple" | "advanced";

function DashboardInner() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mode, setMode] = useState<"simple" | "advanced">("simple");
  const [activeView, setActiveView] = useState<"master" | "faculty" | "graph" | "courses" | "students" | "wizard">("wizard");
  const [toast, setToast] = useState<{ message: string; type: "info" | "success" | "warning" | "error" } | null>(null);
  const [showDrawer, setShowDrawer] = useState(false);

  const { autoSolveCSP, getConstraintHealth } = useSchedule();

  const showToast = (message: string, type: "info" | "success" | "warning" | "error" = "info") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const handleAutoSolve = () => {
    const solved = autoSolveCSP();
    if (solved) showToast("CSP Auto-Solve: feasible timetable generated", "success");
    else showToast("CSP solver could not satisfy all constraints — relax instructor availability", "warning");
  };

  const availableViews = mode === "simple" ? ["wizard"] : ["master", "faculty", "graph", "courses", "students"];
  if (mode === "simple" && activeView !== "wizard") setActiveView("wizard");

  return (
    <div className="h-screen w-screen bg-background font-sans text-foreground flex flex-col overflow-hidden no-select">
      <Header
        onAutoSolve={handleAutoSolve}
        onExportCSV={() => {}}
        onExportJSON={() => {}}
        onEmergencyClick={() => setShowDrawer(true)}
      />
      <HealthBar />

      <div className="flex-1 flex overflow-hidden">
        <Sidebar
          activeView={activeView}
          setActiveView={setActiveView}
          mode={mode}
          setMode={setMode}
          availableViews={availableViews}
        />

        <main className="flex-1 min-h-0 bg-muted/30 flex flex-col relative overflow-hidden">
          <div className="bg-muted/30 border-b border-border px-4 py-2 shrink-0 flex items-center justify-between text-xs">
            <div className="flex items-center space-x-2">
              {(() => {
                const config = VIEW_CONFIG[activeView];
                if (!config?.icon) return null;
                return <config.icon className="w-4 h-4 text-primary" />;
              })()}
              <span className="font-bold text-foreground">{VIEW_CONFIG[activeView]?.label}</span>
            </div>
            <HealthBar />
          </div>

          <div className="flex-1 min-h-0 bg-background p-3 overflow-y-auto custom-scrollbar">
            {activeView === "wizard" && <WizardView onToast={showToast} />}
            {activeView === "master" && <MasterTimetableView onToast={showToast} />}
            {activeView === "faculty" && <FacultyView onToast={showToast} />}
            {activeView === "graph" && <GraphView onToast={showToast} />}
            {activeView === "courses" && <CoursesView onToast={showToast} />}
            {activeView === "students" && <StudentsView onToast={showToast} />}
          </div>

          <Footer />
        </main>
      </div>

      <DisruptionDrawer
        isOpen={showDrawer}
        onClose={() => setShowDrawer(false)}
        onToast={showToast}
      />

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}

function Dashboard() {
  return (
    <ScheduleProvider>
      <DashboardInner />
    </ScheduleProvider>
  );
}

export { Dashboard };