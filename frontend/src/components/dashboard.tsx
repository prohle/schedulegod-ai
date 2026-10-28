"use client";

import { useState, useEffect } from "react";
import { Calendar, UserCheck, GitFork, BookOpen, Users, Sparkles, FileSpreadsheet, Download, ShieldCheck, CheckCircle2, Building, Clock, Navigation, Plus, ChevronLeft, ChevronRight, GraduationCap, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/components/theme-provider";
import { useScenario, useCopilot, useSolve } from "@/hooks/use-api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Modal } from "@/components/ui/modal";
import { Toast } from "@/components/ui/toast";
import { MasterTimetableView } from "./views/master-timetable";
import { FacultyView } from "./views/faculty";
import { GraphView } from "./views/graph";
import { CoursesView } from "./views/courses";
import { StudentsView } from "./views/students";
import { HealthBar } from "./health-bar";
import { DisruptionDrawer } from "./disruption-drawer";
import { Header } from "./header";
import { Footer } from "./footer";
import type { CopilotResponse, Operation, Scenario } from "@/types";

export type Tab = "master" | "faculty" | "graph" | "courses" | "students";

export function Dashboard() {
  const { resolvedTheme } = useTheme();
  const { scenario, loading: scenarioLoading, error: scenarioError, refetch } = useScenario();
  const { response, loading: copilotLoading, send, sendEmergency } = useCopilot();
  const [activeTab, setActiveTab] = useState<Tab>("master");
  const [toast, setToast] = useState<{ message: string; type: "info" | "success" | "warning" | "error" } | null>(null);
  const [showDisruptionDrawer, setShowDisruptionDrawer] = useState(false);

  const showToast = (message: string, type: "info" | "success" | "warning" | "error" = "info") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const handleCopilotMessage = async (message: string) => {
    await send(message);
    if (response?.healing_notes?.length) {
      showToast(response.healing_notes[0], "info");
    }
    refetch();
  };

  const handleEmergency = async (message: string) => {
    await sendEmergency(message);
    setShowDisruptionDrawer(true);
    if (response?.healing_notes?.length) {
      showToast(response.healing_notes[0], "warning");
    }
    refetch();
  };

  if (scenarioLoading) {
    return (
      <div className="h-screen w-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground text-sm">Loading ScheduleGod AI...</p>
        </div>
      </div>
    );
  }

  if (scenarioError) {
    return (
      <div className="h-screen w-screen bg-background flex items-center justify-center">
        <div className="text-center p-8">
          <ShieldCheck className="w-12 h-12 text-destructive mx-auto mb-4" />
          <h2 className="text-xl font-bold text-foreground mb-2">Failed to load scenario</h2>
          <p className="text-muted-foreground mb-4">{scenarioError}</p>
          <Button onClick={refetch} variant="primary">Retry</Button>
        </div>
      </div>
    );
  }

  if (!scenario) return null;

  return (
    <div className="h-screen w-screen bg-background font-sans text-foreground flex flex-col overflow-hidden">
      {/* Header */}
      <Header
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onAutoSolve={() => handleCopilotMessage("Auto-solve the full timetable for all cohorts and constraints.")}
        onExportCSV={() => showToast("CSV export not yet implemented", "info")}
        onExportJSON={() => showToast("JSON export not yet implemented", "info")}
        onEmergencyClick={() => setShowDisruptionDrawer(true)}
      />

      {/* Health Bar */}
      <HealthBar scenario={scenario} response={response} />

      {/* Main Content */}
      <main className="flex-1 min-h-0 bg-muted/30 p-2 flex flex-col relative overflow-hidden">
        {activeTab === "master" && <MasterTimetableView scenario={scenario} onCopilotMessage={handleCopilotMessage} />}
        {activeTab === "faculty" && <FacultyView scenario={scenario} onCopilotMessage={handleCopilotMessage} />}
        {activeTab === "graph" && <GraphView scenario={scenario} />}
        {activeTab === "courses" && <CoursesView scenario={scenario} />}
        {activeTab === "students" && <StudentsView scenario={scenario} />}
      </main>

      {/* Footer */}
      <Footer scenario={scenario} response={response} />

      {/* Disruption Drawer */}
      <DisruptionDrawer
        isOpen={showDisruptionDrawer}
        onClose={() => setShowDisruptionDrawer(false)}
        scenario={scenario}
        onEmergency={handleEmergency}
        onCopilotMessage={handleCopilotMessage}
      />

      {/* Toast */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}