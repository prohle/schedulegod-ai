"use client";

// Faithful port of local-design.html footer: live counts + system status.
import { Building, User, Book } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSchedule } from "@/lib/schedule-store";

export function Footer() {
  const { professors, courses, masterSchedule, getConstraintHealth } = useSchedule();
  const health = getConstraintHealth();

  return (
    <footer className="bg-card border-t border-border px-3 py-1.5 shrink-0 flex items-center justify-between text-xs shadow-sm">
      <div className="flex items-center space-x-3 text-[11px] text-muted-foreground flex-wrap gap-2">
        <span className="flex items-center space-x-1">
          <Building className="w-3.5 h-3.5 text-primary" />
          <span>Rooms: <strong className="text-foreground">A101 (Bldg A), B204 (Bldg B), C108 (Bldg C)</strong></span>
        </span>
        <span>•</span>
        <span className="flex items-center space-x-1">
          <User className="w-3.5 h-3.5 text-indigo-500" />
          <span>Professors: <strong className="text-foreground" id="footer-prof-count">{professors.length} Active</strong></span>
        </span>
        <span>•</span>
        <span className="flex items-center space-x-1">
          <Book className="w-3.5 h-3.5 text-emerald-500" />
          <span>Courses: <strong className="text-foreground" id="footer-course-count">{courses.length} Active</strong></span>
        </span>
        <span className="hidden md:inline">•</span>
        <span className="hidden md:flex items-center space-x-1">
          <span>Sections: <strong className="text-foreground">{Object.keys(masterSchedule).length}</strong></span>
        </span>
      </div>

      <div className={cn("text-[11px] font-semibold flex items-center space-x-1", health.allPassed ? "text-emerald-600" : "text-amber-600")}>
        {health.allPassed ? (
          <>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Cohort Analytics Active — All Constraints Satisfied</span>
          </>
        ) : (
          <>
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            <span>Constraints Unfulfilled — Adjust Schedule</span>
          </>
        )}
      </div>
    </footer>
  );
}