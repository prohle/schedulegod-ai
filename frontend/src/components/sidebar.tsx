"use client";

import {
  LayoutDashboard,
  Users,
  GitFork,
  BookOpen,
  GraduationCap,
  Zap,
  Settings,
  ChevronLeft,
} from "lucide-react";
import { useSchedule } from "@/lib/schedule-store";

export type ActiveView = "master" | "faculty" | "graph" | "courses" | "students" | "wizard";
export type Mode = "simple" | "advanced";

const VIEW_CONFIG = {
  master: { label: "Master Timetable", icon: LayoutDashboard, desc: "Drag-drop grid, auto-solve" },
  faculty: { label: "Faculty & Traversal", icon: Users, desc: "Paint availability, walking distance" },
  graph: { label: "DAG & Graduation", icon: GitFork, desc: "Prerequisite graph, term traversal" },
  courses: { label: "Cohort Demand", icon: BookOpen, desc: "Demand vs scheduled sections" },
  students: { label: "Student Audits", icon: GraduationCap, desc: "Conflict-free enrollment, progress" },
  wizard: { label: "Guided Wizard", icon: Zap, desc: "Step-by-step: Intake → Build → Review" },
} as const;

interface SidebarProps {
  activeView: ActiveView;
  setActiveView: (view: ActiveView) => void;
  mode: Mode;
  setMode: (mode: Mode) => void;
  availableViews: ActiveView[];
}

export function Sidebar({ activeView, setActiveView, mode, setMode, availableViews }: SidebarProps) {
  return (
    <aside className="bg-card border-r border-border flex flex-col shrink-0 w-64">
      <div className="flex flex-col h-full">
        <div className="p-3 border-b border-border flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-gradient-to-tr from-sky-500 to-indigo-600 rounded-lg text-white shadow-md">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-extrabold text-sm">ScheduleGod</h2>
              <p className="text-[10px] text-muted-foreground">Cohort Demand Engine</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-2 space-y-1 overflow-y-auto" role="navigation" aria-label="Main navigation">
          <div className="space-y-1">
            {availableViews.map((viewKey) => {
              const config = VIEW_CONFIG[viewKey];
              const isActive = activeView === viewKey;
              return (
                <button
                  key={viewKey}
                  onClick={() => setActiveView(viewKey as "master" | "faculty" | "graph" | "courses" | "students" | "wizard")}
                  className={`w-full justify-start text-xs gap-2 px-2 py-2 rounded-lg transition-colors ${
                    activeView === viewKey
                      ? "bg-primary/10 text-primary border border-primary/30 shadow-sm"
                      : "hover:bg-muted text-foreground"
                  }`}
                >
                  {config.icon}
                  <span className="flex-1 text-left">
                    <span className="block font-medium">{config.label}</span>
                    <span className="block text-[10px] text-muted-foreground">{config.desc}</span>
                  </span>
                </button>
              );
            })}
          </div>

          <div className="p-2 border-t border-border shrink-0">
            <div className="text-[10px] text-muted-foreground mb-1.5 uppercase tracking-wider">Mode</div>
            <div className="flex items-center space-x-1 bg-muted/50 p-0.5 rounded-lg border border-border">
              <button
                className={`px-2 py-1 text-[10px] rounded transition-colors flex items-center gap-1 ${mode === "simple" ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`}
                onClick={() => { setMode("simple"); setActiveView("wizard"); }}
              >
                <Zap className="w-3.5 h-3.5" /> Guided
              </button>
              <button
                className="px-2 py-1 text-[10px] rounded transition-colors flex items-center gap-1"
                onClick={() => { setMode("advanced"); setActiveView("master"); }}
              >
                <Settings className="w-3.5 h-3.5" /> Expert
              </button>
            </div>
          </div>
        </nav>
      </div>
    </aside>
  );
}