"use client";

// Faithful port of local-design.html VIEW 5: Student Degree Progress & Audits.
// Conflict-free enrollment (min 4 courses), personal schedule grid.
import { useState } from "react";
import { GraduationCap, CheckCircle2, Target, AlertTriangle, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useSchedule, DAYS, TOTAL_SLOTS, START_MINS, SLOT_MINS, slotToTimeStr } from "@/lib/schedule-store";

interface StudentsViewProps {
  onToast: (message: string, type?: "info" | "success" | "warning" | "error") => void;
}

export function StudentsView({ onToast }: StudentsViewProps) {
  void onToast;
  const { students, activeStudentId, setActiveStudentId, getStudentEnrolledCourses } = useSchedule();
  const student = students.find(s => s.id === activeStudentId) || students[0];
  const enrolled = getStudentEnrolledCourses(student);

  const totalDegreeReqs = student.completed.length + student.requiredRemaining.length;
  const completionPct = Math.round((student.completed.length / totalDegreeReqs) * 100);
  const meetsMinimum = enrolled.length >= 4;

  return (
    <div className="view-panel h-full w-full flex flex-col min-h-0 bg-card border border-border rounded-lg shadow-sm">
      <div className="bg-muted/50 border-b border-border rounded-t-lg p-3 shrink-0 flex items-center justify-between text-xs">
        <div className="flex items-center space-x-3">
          <span className="font-bold text-muted-foreground">Select Student Profile:</span>
          <Select value={activeStudentId} onChange={e => setActiveStudentId(e.target.value)} className="bg-primary/10 text-primary font-bold border-primary/50 rounded px-2.5 py-1">
            {students.map(s => <option key={s.id} value={s.id}>{s.name} ({s.degree})</option>)}
          </Select>
        </div>
      </div>

      <div className="flex-1 bg-muted/30 p-3 overflow-hidden flex flex-col lg:flex-row gap-3 min-h-0">
        <div className="w-full lg:w-1/3 bg-card border border-border rounded-lg p-3 flex flex-col overflow-y-auto custom-scrollbar shadow-sm">
          <div className="border-b border-border pb-3 mb-3">
            <h2 className="font-extrabold text-sm text-foreground">{student.name}</h2>
            <p className="text-xs text-primary font-semibold">{student.degree} • Cohort {student.cohortYear}</p>
            <div className="mt-2">
              <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                <span>Degree Completion</span>
                <span className="font-bold text-foreground">{completionPct}%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                <div className="bg-gradient-to-r from-sky-500 to-emerald-500 h-full" style={{ width: `${completionPct}%` }} />
              </div>
            </div>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <h4 className="font-bold text-emerald-700 text-[11px] uppercase tracking-wider mb-1">Completed Courses ({student.completed.length})</h4>
              <div className="flex flex-wrap gap-1">
                {student.completed.map(c => (
                  <span key={c} className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold text-[10px]">{c}</span>
                ))}
              </div>
            </div>

            <div>
              <h4 className="font-bold text-amber-700 text-[11px] uppercase tracking-wider mb-1">Remaining Degree Requirements ({student.requiredRemaining.length})</h4>
              <div className="flex flex-wrap gap-1">
                {student.requiredRemaining.map(c => (
                  <span key={c} className="px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 font-bold text-[10px]">{c}</span>
                ))}
              </div>
            </div>

            <div className="pt-2 border-t border-border">
              <h4 className="font-bold text-primary text-[11px] uppercase tracking-wider mb-1">Conflict-Free Enrolled Schedule</h4>
              <p className="text-[10px] text-muted-foreground mb-2">Rule: Every student MUST be capable of taking AT LEAST 4 required courses without time overlaps.</p>
              <div className={cn(
                "p-2 rounded border font-bold text-xs flex items-center justify-between",
                meetsMinimum ? "border-emerald-300 text-emerald-800" : "border-red-300 text-red-800"
              )}>
                <span>Target Minimum (4 Courses):</span>
                <span>{enrolled.length} / 4 Courses Enrolled</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 bg-card border border-border rounded-lg p-3 flex flex-col min-h-0 shadow-sm">
          <h3 className="font-bold text-xs text-foreground mb-2 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <GraduationCap className="w-4 h-4 text-primary" />
              Personalized Weekly Schedule (Min 4 Courses Required)
            </span>
            <Badge variant={meetsMinimum ? "success" : "destructive"} className="text-[10px]">
              {enrolled.length} Courses Enrolled
            </Badge>
          </h3>

          <div className="flex-1 border border-border rounded overflow-hidden bg-background flex flex-col min-h-0">
            <div className="grid grid-cols-7 bg-muted border-b border-border font-bold text-[10px] text-muted-foreground shrink-0">
              <div className="p-1 text-center border-r border-border bg-muted/70 flex items-center justify-center">Time</div>
              {DAYS.map(day => <div key={day} className="p-1 text-center border-r border-border last:border-r-0 flex items-center justify-center">{day}</div>)}
            </div>
            <div className="flex-1 flex flex-col min-h-0 overflow-y-auto custom-scrollbar">
              {Array.from({ length: TOTAL_SLOTS }, (_, slot) => {
                const timeStr = slotToTimeStr(slot);
                const isHour = (START_MINS + slot * SLOT_MINS) % 60 === 0;
                return (
                  <div key={slot} className="flex-1 min-h-[26px] grid grid-cols-7">
                    <div className={cn("text-[8px] font-mono text-muted-foreground bg-muted/50 border-r border-border flex items-center justify-center leading-none", isHour && "border-t-2 border-t-border")}>
                      {timeStr}
                    </div>
                    {DAYS.map((_, day) => {
                      const match = enrolled.find(e => e.day === day && e.slot === slot);
                      if (match) {
                        return (
                          <div key={`${day}-${slot}`} className="border-r border-border/80 last:border-r-0 p-0.5 bg-emerald-100 text-emerald-900 flex flex-col items-center justify-center text-[9px] font-bold border-l-2 border-l-emerald-600">
                            <span>{match.courseId}</span>
                            <span className="text-[7px] text-emerald-700">{match.room.split(" ")[0]}</span>
                          </div>
                        );
                      }
                      return <div key={`${day}-${slot}`} className="border-r border-border/50 last:border-r-0" />;
                    })}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-2 flex items-center space-x-2 text-[10px] text-muted-foreground">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            Enrollment derived from masterSchedule with zero time overlaps (conflict-free by construction).
          </div>
        </div>
      </div>
    </div>
  );
}