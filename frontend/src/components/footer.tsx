"use client";

import { Building, User, Book, Zap, CheckCircle2, AlertTriangle, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Scenario, CopilotResponse } from "@/types";

interface FooterProps {
  scenario: Scenario;
  response: CopilotResponse | null;
}

export function Footer({ scenario, response }: FooterProps) {
  const totalSections = scenario.sections.length;
  const placedSections = response?.result?.timetable?.placements.length ?? 0;
  const feasibility = response?.result?.status === "infeasible" ? "Infeasible" : response?.result?.status === "optimal" ? "Optimal" : "Feasible";
  const solveTime = response?.result?.solve_time_ms ?? 0;

  return (
    <footer className="bg-card border-t border-border px-3 py-1.5 shrink-0 flex items-center justify-between text-xs shadow-sm">
      <div className="flex items-center space-x-3 text-[11px] text-muted-foreground flex-wrap gap-2">
        <span className="flex items-center space-x-1">
          <Building className="w-3.5 h-3.5 text-primary" />
          <span>Rooms: <strong>{scenario.rooms.length}</strong> across <strong>{scenario.buildings.length}</strong> buildings</span>
        </span>
        <span className="hidden sm:inline">•</span>
        <span className="flex items-center space-x-1">
          <User className="w-3.5 h-3.5 text-indigo-500" />
          <span>Faculty: <strong>{scenario.instructors.length}</strong> Active</span>
        </span>
        <span className="hidden sm:inline">•</span>
        <span className="flex items-center space-x-1">
          <Book className="w-3.5 h-3.5 text-emerald-500" />
          <span>Courses: <strong>{scenario.courses.length}</strong> Active</span>
        </span>
        <span className="hidden sm:inline">•</span>
        <span className="flex items-center space-x-1">
          <Users className="w-3.5 h-3.5 text-amber-500" />
          <span>Cohorts: <strong>{scenario.cohorts.length}</strong> Programs</span>
        </span>
      </div>

      <div className="flex items-center space-x-3 text-[11px] font-semibold">
        <div className={cn("flex items-center space-x-1", feasibility === "Optimal" ? "text-emerald-600" : feasibility === "Feasible" ? "text-sky-600" : "text-amber-600")}>
          <span className={cn("w-2 h-2 rounded-full", feasibility === "Optimal" ? "bg-emerald-500 animate-pulse" : feasibility === "Feasible" ? "bg-sky-500 animate-pulse" : "bg-amber-500")} />
          <span>Solver: {feasibility}</span>
        </div>
        <span className="text-muted-foreground">•</span>
        <span className="flex items-center space-x-1 text-muted-foreground">
          <span>{solveTime} ms</span>
        </span>
        <span className="hidden sm:inline text-muted-foreground">•</span>
        <span className="hidden sm:inline flex items-center space-x-1 text-muted-foreground">
          <span>{placedSections}/{totalSections} placed</span>
        </span>
      </div>
    </footer>
  );
}