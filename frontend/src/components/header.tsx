"use client";

// Minimal top bar: logo + global actions only.
// Navigation moved to vertical sidebar.
import { GraduationCap, Zap, Sparkles, AlertTriangle, Download, FileSpreadsheet } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface HeaderProps {
  onAutoSolve: () => void;
  onExportCSV: () => void;
  onExportJSON: () => void;
  onEmergencyClick: () => void;
}

export function Header({ onAutoSolve, onExportCSV, onExportJSON, onEmergencyClick }: HeaderProps) {
  return (
    <header className="bg-card border-b border-border px-4 py-2 flex items-center justify-between shrink-0 text-xs shadow-sm">
      <div className="flex items-center space-x-3">
        <div className="p-2 bg-gradient-to-tr from-sky-500 to-indigo-600 rounded-lg text-white shadow-md shadow-sky-500/20">
          <GraduationCap className="w-4 h-4" />
        </div>
        <div>
          <h1 className="font-extrabold text-sm text-foreground tracking-tight flex items-center gap-2">
            ScheduleGod AI
            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-sky-100 text-sky-700 border border-sky-200">
              Dynamic CSP
            </span>
          </h1>
          <p className="text-[10px] text-muted-foreground">Academic Scheduler & Cohort Demand Engine</p>
        </div>
      </div>

      <div className="flex items-center space-x-2 flex-wrap gap-2">
        <Button variant="primary" size="sm" onClick={onAutoSolve} className="flex items-center space-x-1.5 shadow-sm bg-emerald-600 hover:bg-emerald-700">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Auto-Solve</span>
        </Button>
        <Button variant="outline" size="sm" onClick={onExportCSV} className="flex items-center space-x-1 hidden md:flex">
          <FileSpreadsheet className="w-3.5 h-3.5" />
          <span>CSV</span>
        </Button>
        <Button variant="outline" size="sm" onClick={onExportJSON} className="flex items-center space-x-1 hidden md:flex">
          <Download className="w-3.5 h-3.5" />
          <span>Export</span>
        </Button>
        <Button variant="outline" size="sm" onClick={onEmergencyClick} className="flex items-center space-x-1 border-amber-300 text-amber-700 hover:bg-amber-50">
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>Emergency</span>
        </Button>
      </div>
    </header>
  );
}