"use client";

import { useState } from "react";
import { Users, GraduationCap, BookOpen, CheckCircle2, Clock, AlertTriangle, Target, AlertCircle, TrendingUp, Building, User, Book, Award } from "lucide-react";
import { cn } from "@/lib/utils";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import type { Scenario, Cohort, Course } from "@/types";

interface StudentsViewProps {
  scenario: Scenario;
}

export function StudentsView({ scenario }: StudentsViewProps) {
  const [selectedStudentId, setSelectedStudentId] = useState(scenario.cohorts[0]?.id || "");

  const selectedStudent = scenario.cohorts.find(s => s.id === selectedStudentId) || scenario.cohorts[0];

  return (
    <div className="view-panel h-full w-full flex flex-col min-h-0 bg-card border border-border rounded-lg shadow-sm">
      {/* Header */}
      <div className="bg-muted/50 border-b border-border rounded-t-lg p-3 shrink-0 flex items-center justify-between text-xs">
        <div className="flex items-center space-x-3">
          <span className="font-bold text-muted-foreground">Select Student Profile:</span>
          <Select value={selectedStudentId} onChange={(e) => setSelectedStudentId(e.target.value)} className="w-auto min-w-[280px] bg-primary/10 text-primary font-bold border-primary/50 rounded px-2.5 py-1">
            {scenario.cohorts.map(s => (
              <option key={s.id} value={s.id}>{s.name} ({s.degree})</option>
            ))}
          </Select>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 bg-muted/30 p-3 overflow-hidden flex flex-col lg:flex-row gap-3 min-h-0">
        {/* Left Column: Degree Audit Breakdown */}
        <div className="w-full lg:w-1/3 bg-card border border-border rounded-lg p-3 flex flex-col overflow-y-auto custom-scrollbar shadow-sm">
          <StudentAuditDetail student={selectedStudent} scenario={scenario} />
        </div>

        {/* Right Column: Student Schedule Visualizer */}
        <div className="flex-1 bg-card border border-border rounded-lg p-3 flex flex-col min-h-0 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-bold text-xs text-foreground flex items-center gap-1.5">
              <GraduationCap className="w-4 h-4 text-primary" />
              Personalized Weekly Schedule (Min 4 Courses Required)
            </h3>
            <Badge variant="success" className="text-[10px]">
              <CheckCircle2 className="w-3 h-3 mr-1" />
              {selectedStudent.requiredRemaining?.length || 4} Courses Enrolled
            </Badge>
          </div>
          <StudentScheduleGrid student={selectedStudent} scenario={scenario} />
        </div>
      </div>
    </div>
  );
}

function StudentAuditDetail({ student, scenario }: { student: Cohort; scenario: Scenario }) {
  const completedCount = student.completed?.length || 0;
  const requiredCount = student.requiredRemaining?.length || 0;
  const totalRequired = completedCount + requiredCount;
  const progress = totalRequired > 0 ? Math.round((completedCount / totalRequired) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Student Header */}
      <div className="bg-muted/50 border border-border rounded-lg p-3">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="font-bold text-sm text-foreground">{student.name}</div>
            <div className="text-[10px] text-muted-foreground">{student.degree}</div>
          </div>
          <Badge variant="info" className="text-[10px]">{student.cohortYear}</Badge>
        </div>

        {/* Progress Bar */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-muted-foreground">Degree Progress</span>
            <span className="font-bold text-foreground">{progress}%</span>
          </div>
          <div className="bg-muted h-2 rounded-full overflow-hidden">
            <div className="bg-primary h-full rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <span>{completedCount} completed</span>
            <span>{requiredCount} remaining</span>
          </div>
        </div>
      </div>

      {/* Completed Courses */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="font-bold text-xs text-foreground flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            Completed Courses ({completedCount})
          </h4>
        </div>
        <div className="space-y-1 max-h-40 overflow-y-auto custom-scrollbar">
          {student.completed?.length ? (
            student.completed.map(courseId => {
              const course = scenario.courses.find(c => c.id === courseId);
              return (
                <div key={courseId} className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded p-2 text-xs flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="font-medium text-emerald-800 dark:text-emerald-200">{course?.code || courseId}</span>
                  </div>
                  <Badge variant="success" className="text-[9px]">Done</Badge>
                </div>
              );
            })
          ) : (
            <div className="text-center py-4 text-muted-foreground text-xs">No courses completed yet</div>
          )}
        </div>
      </div>

      {/* Remaining Required Courses */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="font-bold text-xs text-foreground flex items-center gap-1.5">
            <Target className="w-3.5 h-3.5 text-sky-500" />
            Required Remaining ({requiredCount})
          </h4>
        </div>
        <div className="space-y-1 max-h-40 overflow-y-auto custom-scrollbar">
          {student.requiredRemaining?.length ? (
            student.requiredRemaining.map(courseId => {
              const course = scenario.courses.find(c => c.id === courseId);
              const isPrereqMet = course?.prereqs?.every(p => student.completed?.includes(p)) ?? true;
              return (
                <div key={courseId} className={cn("bg-sky-50 dark:bg-sky-900/20 border border-sky-200 dark:border-sky-800 rounded p-2 text-xs flex items-center justify-between", !isPrereqMet && "border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20")}>
                  <div className="flex items-center space-x-2">
                    <Target className="w-3.5 h-3.5 text-sky-500" />
                    <span className="font-medium text-sky-800 dark:text-sky-200">{course?.code || courseId}</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    {!isPrereqMet && <Badge variant="warning" className="text-[9px]">Prereq Missing</Badge>}
                    <Badge variant="info" className="text-[9px]">Required</Badge>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center py-4 text-muted-foreground text-xs">All requirements satisfied!</div>
          )}
        </div>
      </div>

      {/* Prerequisite Alerts */}
      {student.requiredRemaining?.some(courseId => {
        const course = scenario.courses.find(c => c.id === courseId);
        return course?.prereqs?.some(p => !student.completed?.includes(p));
      }) && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
          <div className="flex items-start space-x-2 text-xs">
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-amber-800 dark:text-amber-200">Prerequisite Alert</div>
              <div className="text-amber-700 dark:text-amber-300 mt-1">
                Some required courses have unmet prerequisites. Review course sequence before registration.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StudentScheduleGrid({ student, scenario }: { student: Cohort; scenario: Scenario }) {
  const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const PERIOD_NAMES = ["8:00", "10:00", "13:00", "15:00"];

  // In a real implementation, this would come from the solver result
  // For now, show empty grid with student's required courses listed

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      <div className="grid grid-cols-7 bg-muted/50 border-b border-border font-bold text-[11px] text-muted-foreground shrink-0">
        <div className="p-1.5 text-center border-r border-border bg-muted/50 flex items-center justify-center">Time</div>
        {DAY_NAMES.map(day => (
          <div key={day} className="p-1.5 text-center border-r border-border last:border-r-0 flex items-center justify-center">{day}</div>
        ))}
      </div>
      <div className="flex-1 flex flex-col min-h-0 overflow-y-auto custom-scrollbar">
        {PERIOD_NAMES.map((periodName, slot) => (
          <div key={slot} className="flex-1 min-h-[60px] grid grid-cols-7 border-t border-border/60">
            <div className="text-[9px] font-mono text-muted-foreground bg-muted/50 border-r border-border flex items-center justify-center text-center px-0.5 leading-none">
              {periodName}
            </div>
            {DAY_NAMES.map((_, day) => (
              <div key={`${day}-${slot}`} className="border-r border-border/60 last:border-r-0 flex items-center justify-center text-[9px] text-muted-foreground hover:bg-accent/50 transition">
                <span className="pointer-events-none">+</span>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Required Courses Legend */}
      <div className="mt-3 pt-3 border-t border-border">
        <h4 className="font-bold text-xs text-foreground mb-2">Required Courses to Schedule:</h4>
        <div className="flex flex-wrap gap-1.5">
          {student.requiredRemaining?.map(courseId => {
            const course = scenario.courses.find(c => c.id === courseId);
            return (
              <Badge key={courseId} variant="info" className="text-[10px]">
                {course?.code || courseId}
              </Badge>
            );
          })}
          {student.completed?.map(courseId => {
            const course = scenario.courses.find(c => c.id === courseId);
            return (
              <Badge key={courseId} variant="success" className="text-[10px]">
                <CheckCircle2 className="w-3 h-3 mr-1" />
                {course?.code || courseId}
              </Badge>
            );
          })}
        </div>
      </div>
    </div>
  );
}