"use client";

import { useState } from "react";
import { GraduationCap, AlertTriangle, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
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

export type Tab = "master" | "faculty" | "graph" | "courses" | "students";

function DashboardInner() {
  const { autoSolveCSP, professors, courses } = useSchedule();
  const [activeTab, setActiveTab] = useState<Tab>("master");
  const [toast, setToast] = useState<{ message: string; type: "info" | "success" | "warning" | "error" } | null>(null);
  const [showDrawer, setShowDrawer] = useState(false);

  const showToast = (message: string, type: "info" | "success" | "warning" | "error" = "info") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const handleAutoSolve = () => {
    const solved = autoSolveCSP();
    if (solved) showToast("Cohort CSP Auto-Solve: feasible timetable generated", "success");
    else showToast("CSP solver could not satisfy all constraints — relax instructor availability", "warning");
  };

  return (
    <div className="h-screen w-screen bg-background font-sans text-foreground flex flex-col overflow-hidden no-select">
      <Header
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onAutoSolve={handleAutoSolve}
        onExportCSV={() => showToast("CSV export coming soon", "info")}
        onExportJSON={() => showToast("JSON export coming soon", "info")}
        onEmergencyClick={() => setShowDrawer(true)}
      />
      <HealthBar />
      <main className="flex-1 min-h-0 bg-muted/30 p-2 flex flex-col relative overflow-hidden">
        {activeTab === "master" && <MasterTimetableView onToast={showToast} />}
        {activeTab === "faculty" && <FacultyView onToast={showToast} />}
        {activeTab === "graph" && <GraphView onToast={showToast} />}
        {activeTab === "courses" && <CoursesView onToast={showToast} />}
        {activeTab === "students" && <StudentsView onToast={showToast} />}
      </main>
      <Footer />
      <DisruptionDrawer
        isOpen={showDrawer}
        onClose={() => setShowDrawer(false)}
        onToast={showToast}
      />
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}

export function Dashboard() {
  return (
    <ScheduleProvider>
      <DashboardInner />
    </ScheduleProvider>
  );
}