"use client";

import { Calendar, Sparkles, FileSpreadsheet, Download, AlertTriangle, Users, Building, BookOpen, GitFork, UserCheck, AlertCircle, GraduationCap } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { Tab } from "@/components/dashboard";

interface HeaderProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  onAutoSolve: () => void;
  onExportCSV: () => void;
  onExportJSON: () => void;
  onEmergencyClick: () => void;
}

export function Header({ activeTab, onTabChange, onAutoSolve, onExportCSV, onExportJSON, onEmergencyClick }: HeaderProps) {
  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "master", label: "Master Timetable", icon: <Calendar className="w-3.5 h-3.5" /> },
    { id: "faculty", label: "Faculty & Traversal", icon: <UserCheck className="w-3.5 h-3.5" /> },
    { id: "graph", label: "DAG & Graduation", icon: <GitFork className="w-3.5 h-3.5" /> },
    { id: "courses", label: "Cohort Demand & Catalog", icon: <BookOpen className="w-3.5 h-3.5" /> },
    { id: "students", label: "Student Audits", icon: <Users className="w-3.5 h-3.5" /> },
  ];

  return (
    <header className="bg-card border-b border-border px-4 py-2 flex items-center justify-between shrink-0 text-xs shadow-sm">
      <div className="flex items-center space-x-3">
        <div className="p-2 bg-gradient-to-tr from-sky-500 to-indigo-600 rounded-lg text-white shadow-md shadow-sky-500/20">
          <GraduationCap className="w-4 h-4" />
        </div>
        <div>
          <h1 className="font-extrabold text-sm text-foreground tracking-tight flex items-center gap-2">
            ScheduleGod AI
            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
              Dynamic CSP
            </span>
          </h1>
          <p className="text-[10px] text-muted-foreground">Mon–Fri • 8:00 AM – 3:00 PM • Cohort Requirement & Faculty Engine</p>
        </div>
      </div>

      <div className="flex items-center space-x-1 bg-muted/50 p-1 rounded-xl border border-border">
        {tabs.map((tab) => (
          <Button
            key={tab.id}
            variant={activeTab === tab.id ? "primary" : "ghost"}
            size="sm"
            onClick={() => onTabChange(tab.id)}
            className="flex items-center space-x-1.5"
          >
            {tab.icon}
            <span>{tab.label}</span>
          </Button>
        ))}
      </div>

      <div className="flex items-center space-x-2">
        <Button variant="primary" size="sm" onClick={onAutoSolve} className="flex items-center space-x-1.5 shadow-sm">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Cohort CSP Auto-Solve</span>
        </Button>
        <Button variant="outline" size="sm" onClick={onExportCSV} className="flex items-center space-x-1">
          <FileSpreadsheet className="w-3.5 h-3.5" />
          <span>CSV</span>
        </Button>
        <Button variant="outline" size="sm" onClick={onExportJSON} className="flex items-center space-x-1">
          <Download className="w-3.5 h-3.5" />
          <span>Export</span>
        </Button>
        <Button variant="destructive" size="sm" onClick={onEmergencyClick} className="flex items-center space-x-1.5 shadow-sm">
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>Emergency</span>
        </Button>
      </div>
    </header>
  );
}