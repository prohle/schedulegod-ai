"use client";

import { useState } from "react";
import { Plus, TrendingUp, AlertTriangle, Users, Building, BookOpen, AlertCircle, CheckCircle2, Clock, Target, Filter, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import type { Scenario, Course, Cohort } from "@/types";

interface CoursesViewProps {
  scenario: Scenario;
}

export function CoursesView({ scenario }: CoursesViewProps) {
  const [showAddCourse, setShowAddCourse] = useState(false);
  const [filterDept, setFilterDept] = useState("ALL");
  const [sortBy, setSortBy] = useState<"demand" | "name" | "dept">("demand");

  const departments = [...new Set(scenario.courses.map(c => c.dept || "default"))];

  // Calculate demand for each course
  const coursesWithDemand = scenario.courses.map(course => {
    const demandingCohorts = scenario.cohorts.filter(cohort => 
      cohort.requiredRemaining?.includes(course.id) || cohort.completed?.includes(course.id)
    );
    const demandCount = demandingCohorts.reduce((sum, c) => sum + c.size, 0);
    const demandPercentage = Math.round((demandCount / scenario.cohorts.reduce((s, c) => s + c.size, 0)) * 100);

    let requiredSections = 0;
    let statusLabel = "Low Demand";
    let badgeClass = "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600";

    if (demandCount >= 3) {
      requiredSections = 3;
      statusLabel = "High Cohort Demand (Min 3 Sections)";
      badgeClass = "bg-amber-100 dark:bg-amber-900/30 text-amber-900 dark:text-amber-100 border-amber-300 dark:border-amber-700";
    } else if (demandCount > 0) {
      requiredSections = 1;
      statusLabel = "Moderate Demand (Min 1 Section)";
      badgeClass = "bg-sky-100 dark:bg-sky-900/30 text-sky-800 dark:text-sky-200 border-sky-300 dark:border-sky-700";
    }

    return {
      ...course,
      demandCount,
      demandPercentage,
      requiredSections,
      statusLabel,
      badgeClass,
    };
  });

  const filteredCourses = coursesWithDemand
    .filter(c => filterDept === "ALL" || (c.dept || "default") === filterDept)
    .sort((a, b) => {
      if (sortBy === "demand") return b.demandCount - a.demandCount;
      if (sortBy === "name") return a.code.localeCompare(b.code);
      return (a.dept || "").localeCompare(b.dept || "");
    });

  return (
    <div className="view-panel h-full w-full flex flex-col min-h-0 bg-card border border-border rounded-lg shadow-sm">
      {/* Header */}
      <div className="bg-muted/50 border-b border-border rounded-t-lg p-3 shrink-0 flex items-center justify-between">
        <div>
          <h2 className="font-bold text-sm text-foreground">Dynamic Student Cohort Demand Matrix</h2>
          <p className="text-xs text-muted-foreground">Course popularity calculated in real time based on active student cohorts and outstanding degree requirements.</p>
        </div>
        <Button variant="primary" size="sm" onClick={() => setShowAddCourse(true)} className="flex items-center space-x-1 shadow-sm">
          <Plus className="w-3.5 h-3.5" />
          <span>Add New Course</span>
        </Button>
      </div>

      {/* Filters */}
      <div className="bg-muted/30 border-b border-border p-3 shrink-0 flex items-center space-x-3 flex-wrap gap-2">
        <div className="flex items-center space-x-2">
          <span className="text-muted-foreground font-medium text-[11px]">Department:</span>
          <Select value={filterDept} onChange={(e) => setFilterDept(e.target.value)} className="w-auto min-w-[150px]">
            <option value="ALL">All Departments</option>
            {departments.map(d => <option key={d} value={d}>{d}</option>)}
          </Select>
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-muted-foreground font-medium text-[11px]">Sort by:</span>
          <Select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)} className="w-auto min-w-[150px]">
            <option value="demand">Demand (High → Low)</option>
            <option value="name">Course Code (A-Z)</option>
            <option value="dept">Department</option>
          </Select>
        </div>
      </div>

      {/* Course Cards Grid */}
      <div className="flex-1 bg-muted/30 p-3 overflow-y-auto custom-scrollbar">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3" id="courses-card-grid">
          {filteredCourses.map(course => (
            <CourseCard key={course.id} course={course} scenario={scenario} />
          ))}
        </div>
      </div>

      {/* Add Course Modal */}
      <Modal
        isOpen={showAddCourse}
        onClose={() => setShowAddCourse(false)}
        title="Add New Course"
        footer={
          <div className="flex items-center justify-end space-x-2">
            <Button variant="ghost" size="sm" onClick={() => setShowAddCourse(false)}>Cancel</Button>
            <Button variant="primary" size="sm" onClick={() => {
              // Would save the new course
              setShowAddCourse(false);
            }}>Add Course</Button>
          </div>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="block font-bold text-foreground mb-1">Course Code:</label>
            <input type="text" placeholder="e.g., CS202" className="w-full bg-input border border-border rounded px-2 py-1 text-foreground" />
          </div>
          <div>
            <label className="block font-bold text-foreground mb-1">Course Name:</label>
            <input type="text" placeholder="e.g., Advanced Algorithms" className="w-full bg-input border border-border rounded px-2 py-1 text-foreground" />
          </div>
          <div>
            <label className="block font-bold text-foreground mb-1">Department:</label>
            <Select className="w-full">
              {departments.map(d => <option key={d} value={d}>{d}</option>)}
            </Select>
          </div>
          <div>
            <label className="block font-bold text-foreground mb-1">Room Type:</label>
            <Select className="w-full">
              <option value="lecture">Lecture Hall</option>
              <option value="lab">Laboratory</option>
              <option value="seminar">Seminar Room</option>
            </Select>
          </div>
          <div>
            <label className="block font-bold text-foreground mb-1">Pattern:</label>
            <Select className="w-full">
              <option value="MWF">MWF (Mon/Wed/Fri)</option>
              <option value="TTh">TTh (Tue/Thu)</option>
              <option value="block">Weekly Lab Block</option>
            </Select>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function CourseCard({ course, scenario }: { course: any; scenario: Scenario }) {
  const deptColors = {
    CS: "bg-sky-100 dark:bg-sky-900/30 text-sky-900 dark:text-sky-100 border-sky-500",
    Business: "bg-amber-100 dark:bg-amber-900/30 text-amber-900 dark:text-amber-100 border-amber-500",
    Biology: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-900 dark:text-emerald-100 border-emerald-500",
    Humanities: "bg-purple-100 dark:bg-purple-900/30 text-purple-900 dark:text-purple-100 border-purple-500",
    default: "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 border-slate-500",
  };

  const colors = deptColors[course.dept as keyof typeof deptColors] || deptColors.default;

  return (
    <div className={cn("bg-card border border-border rounded-lg p-3 shadow-xs hover:shadow-sm transition-shadow", colors, "border-l-4")}>
      <div className="flex items-start justify-between mb-2">
        <div>
          <div className="font-bold text-sm text-foreground">{course.code}</div>
          <div className="text-[11px] text-muted-foreground truncate">{course.title}</div>
        </div>
        <Badge variant="default" className={course.badgeClass}>{course.statusLabel}</Badge>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs mb-2">
        <div>
          <span className="text-muted-foreground block">Pattern</span>
          <span className="font-medium text-foreground">{course.pattern}</span>
        </div>
        <div>
          <span className="text-muted-foreground block">Room Type</span>
          <span className="font-medium text-foreground">{course.room_type}</span>
        </div>
        <div>
          <span className="text-muted-foreground block">Seats/Section</span>
          <span className="font-medium text-foreground">{course.seats}</span>
        </div>
        <div>
          <span className="text-muted-foreground block">Sections Needed</span>
          <span className="font-bold text-primary">{course.requiredSections}</span>
        </div>
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-border/50">
        <div className="flex items-center space-x-1 text-[10px] text-muted-foreground">
          <Users className="w-3 h-3" />
          <span>{course.demandCount} students need this</span>
        </div>
        <div className="flex items-center space-x-1 text-[10px] text-muted-foreground">
          <Building className="w-3 h-3" />
          <span>{course.equipment?.join(", ") || "Standard"}</span>
        </div>
      </div>

      {course.prereqs && course.prereqs.length > 0 && (
        <div className="mt-2 pt-2 border-t border-border/50">
          <div className="text-[10px] text-muted-foreground flex items-center space-x-1">
            <AlertCircle className="w-3 h-3" />
            Prerequisites: {course.prereqs.join(", ")}
          </div>
        </div>
      )}
    </div>
  );
}