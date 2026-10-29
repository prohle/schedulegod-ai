"use client";

// Minimal top bar: brand only. All actions live in the Guided wizard and the
// Intelligence view, so there is no toy "Auto-Solve" here — every solve in the
// app hits the real CP-SAT backend.
import { GraduationCap } from "lucide-react";

export function Header() {
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
              CP-SAT verified
            </span>
          </h1>
          <p className="text-[10px] text-muted-foreground">
            Academic scheduler · Muse Spark + CP-SAT + spectral intelligence
          </p>
        </div>
      </div>
      <span className="text-[10px] text-muted-foreground hidden md:block">
        Every answer is solver-proven — no guesswork
      </span>
    </header>
  );
}