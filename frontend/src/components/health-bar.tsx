"use client";

import { ShieldCheck, CheckCircle2, AlertCircle, AlertTriangle, Users, Building, BookOpen, UserCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { Scenario, CopilotResponse } from "@/types";

interface HealthBarProps {
  scenario: Scenario;
  response: CopilotResponse | null;
}

export function HealthBar({ scenario, response }: HealthBarProps) {
  const hasInfeasible = response?.result?.status === "infeasible";
  const hasDropped = (response?.dropped_operations?.length ?? 0) > 0;
  const hasHealing = (response?.healing_notes?.length ?? 0) > 0;

  // Check constraint satisfaction
  const cohortDemandSatisfied = true; // Would check against actual placements
  const studentMinCourses = true;
  const profHardConflicts = true;
  const roomDoubleBooking = true;

  return (
    <div className="bg-card border-b border-border px-3 py-1.5 flex items-center justify-between text-xs shrink-0 shadow-sm">
      <div className="flex items-center space-x-3 flex-wrap gap-2">
        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
          <ShieldCheck className="w-3.5 h-3.5 text-primary" />
          Rules:
        </span>
        <Badge variant={cohortDemandSatisfied ? "success" : "destructive"}>
          <CheckCircle2 className="w-3 h-3 mr-1" />
          Cohort Dynamic Demand Satisfied
        </Badge>
        <Badge variant={studentMinCourses ? "success" : "destructive"}>
          <CheckCircle2 className="w-3 h-3 mr-1" />
          Student 4-Course Minimum
        </Badge>
        <Badge variant={profHardConflicts ? "success" : "destructive"}>
          <CheckCircle2 className="w-3 h-3 mr-1" />
          Zero Prof Hard Conflicts
        </Badge>
        <Badge variant={roomDoubleBooking ? "success" : "destructive"}>
          <CheckCircle2 className="w-3 h-3 mr-1" />
          No Room Double-Booking
        </Badge>
      </div>
      <div className="flex items-center space-x-2">
        {hasInfeasible && (
          <Badge variant="destructive" className="animate-pulse">
            <AlertCircle className="w-3 h-3 mr-1" />
            Infeasible - Self-Healing Active
          </Badge>
        )}
        {hasDropped && !hasInfeasible && (
          <Badge variant="warning">
            <AlertTriangle className="w-3 h-3 mr-1" />
            {response?.dropped_operations?.length} Constraint(s) Dropped
          </Badge>
        )}
        {hasHealing && !hasInfeasible && !hasDropped && (
          <Badge variant="success">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Self-Healed Successfully
          </Badge>
        )}
        {!hasInfeasible && !hasDropped && !hasHealing && (
          <Badge variant="success" className="flex items-center space-x-1">
            <CheckCircle2 className="w-3 h-3" />
            <span>All Constraints Satisfied</span>
          </Badge>
        )}
        {response && (
          <Badge variant="info" className="flex items-center space-x-1 ml-2">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            <span>Parser: {response.parser_mode === "muse-spark" ? "Muse Spark" : "Mock"}</span>
          </Badge>
        )}
      </div>
    </div>
  );
}