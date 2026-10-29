"use client";

// Faithful port of local-design.html: constraint health bar with LIVE
// evaluation (room/prof collisions, cohort demand, 4-course minimum).
import { ShieldCheck, CheckCircle2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSchedule } from "@/lib/schedule-store";

export function HealthBar() {
  const { getConstraintHealth } = useSchedule();
  const health = getConstraintHealth();

  const badges = [
    { passed: health.demandOk, label: "Cohort Dynamic Demand Satisfied" },
    { passed: health.studentsOk, label: "Student 4-Course Minimum" },
    { passed: health.profOk, label: "Zero Prof Hard Conflicts" },
    { passed: health.roomsOk, label: "No Room Double-Booking" },
  ];

  return (
    <div className="bg-card border-b border-border px-3 py-1.5 flex items-center justify-between text-xs shrink-0 shadow-sm flex-wrap gap-2">
      <div className="flex items-center space-x-3 flex-wrap gap-2">
        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
          <ShieldCheck className="w-3.5 h-3.5 text-primary" /> Rules:
        </span>
        {badges.map(b => (
          <div
            key={b.label}
            className={cn(
              "flex items-center space-x-1 px-2 py-0.5 rounded text-[11px] font-semibold border",
              b.passed
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : "bg-amber-50 text-amber-700 border-amber-300 animate-pulse"
            )}
          >
            {b.passed ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
            <span>{b.label}</span>
          </div>
        ))}
      </div>
      <div className={cn("text-[11px] font-medium flex items-center space-x-1", health.allPassed ? "text-emerald-600" : "text-amber-600")}>
        {health.allPassed ? <span>All Constraints Satisfied</span> : <span>Constraints Unfulfilled — Adjust Schedule</span>}
      </div>
    </div>
  );
}