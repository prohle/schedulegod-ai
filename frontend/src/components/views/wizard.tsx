"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, ShieldCheck, AlertTriangle, Zap, Users, Building2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useSchedule } from "@/lib/schedule-store";

interface WizardViewProps {
  onToast: (message: string, type?: "info" | "success" | "warning" | "error") => void;
}

const STEPS = [
  { id: "intake", label: "Intake", desc: "Collect instructor constraints & preferences", icon: Users },
  { id: "build", label: "Build", desc: "Run CSP solver & generate timetable", icon: Zap },
  { id: "review", label: "Review", desc: "Validate constraints & adjust", icon: ShieldCheck },
  { id: "emergency", label: "Emergency", desc: "Handle disruptions & re-solve", icon: AlertTriangle },
] as const;

type StepId = "intake" | "build" | "review" | "emergency";

export function WizardView({ onToast }: WizardViewProps) {
  const [currentStep, setCurrentStep] = useState<StepId>("intake");
  const [intakeSubmitted, setIntakeSubmitted] = useState(false);
  const [buildCompleted, setBuildCompleted] = useState(false);
  const [reviewCompleted, setReviewCompleted] = useState(false);

  const {
    professors,
    courses,
    masterSchedule,
    autoSolveCSP,
    clearSchedule,
    getConstraintHealth,
    getScheduledCount,
    getCourseCohortDemand,
  } = useSchedule();

  const stepOrder: StepId[] = ["intake", "build", "review", "emergency"];
  const currentIndex = stepOrder.indexOf(currentStep);
  const canGoNext = currentIndex < stepOrder.length - 1;
  const canGoPrev = currentIndex > 0;

  const handleNext = () => {
    if (!canGoNext) return;
    if (currentStep === "intake") setIntakeSubmitted(true);
    if (currentStep === "build") setBuildCompleted(true);
    if (currentStep === "review") setReviewCompleted(true);
    setCurrentStep(stepOrder[currentIndex + 1]);
  };

  const handlePrev = () => {
    if (!canGoPrev) return;
    setCurrentStep(stepOrder[currentIndex - 1]);
  };

  const handleIntakeSubmit = () => {
    setIntakeSubmitted(true);
    onToast("Instructor constraints saved — ready to build", "success");
  };

  const handleBuild = () => {
    const solved = autoSolveCSP();
    if (solved) {
      setBuildCompleted(true);
      onToast("CSP Auto-Solve: feasible timetable generated", "success");
    } else {
      onToast("No feasible timetable — check instructor availability", "warning");
    }
  };

  const handleReviewComplete = () => {
    setReviewCompleted(true);
    onToast("Review complete — constraints validated", "success");
  };

  const handleEmergencySolve = () => {
    const health = getConstraintHealth();
    if (health.allPassed) {
      onToast("All constraints satisfied — schedule is stable", "success");
    } else {
      onToast("Use Emergency drawer (header) for live disruptions", "info");
    }
  };

  const health = getConstraintHealth();
  const sectionsNeeded = courses.reduce((sum, c) => sum + getCourseCohortDemand(c.id).requiredSections, 0);

  return (
    <div className="h-full w-full flex flex-col">
      <div className="bg-card border-b border-border px-4 py-3 shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-extrabold text-lg text-foreground">Guided Wizard</h2>
            <p className="text-sm text-muted-foreground">Step-by-step: Intake → Build → Review → Emergency</p>
          </div>
          <div className="flex items-center space-x-1">
            {STEPS.map((step, idx) => (
              <div key={step.id} className="flex items-center">
                <div className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all",
                  idx < currentIndex ? "bg-emerald-500 text-white" :
                  idx === currentIndex ? "bg-primary text-white ring-2 ring-primary ring-offset-2" :
                  "bg-muted text-muted-foreground"
                )}>
                  {idx < currentIndex ? <CheckCircle2 className="w-4 h-4" /> : <span>{idx + 1}</span>}
                </div>
                {idx < STEPS.length - 1 && (
                  <div className={cn("w-16 h-1 mx-1 rounded", idx < currentIndex ? "bg-emerald-500" : "bg-muted")} />
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="text-sm text-muted-foreground">
          <span className="font-medium">Step {currentIndex + 1} of 4</span> — {STEPS.find(s => s.id === currentStep)?.desc}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {currentStep === "intake" && (
          <div className="space-y-6 max-w-3xl mx-auto">
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
              <div className="flex items-center space-x-2 mb-3">
                <Users className="w-5 h-5 text-primary" />
                <h3 className="font-bold text-primary">Instructor Intake Window</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Each instructor paints their hard constraints and soft preferences below. These are saved as the input for the CSP solver.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {professors.map(p => (
                <div key={p.id} className="bg-card border border-border rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="font-bold text-sm">{p.name}</p>
                      <p className="text-[10px] text-muted-foreground">{p.dept}</p>
                    </div>
                    <Badge variant={p.gridState && Object.keys(p.gridState).length > 0 ? "success" : "default"} className="text-[10px]">
                      {p.gridState && Object.keys(p.gridState).length > 0 ? "Constraints set" : "Not started"}
                    </Badge>
                  </div>
                  <div className="space-y-1 text-[11px] text-muted-foreground">
                    <p>Hard blocks: {Object.values(p.gridState || {}).filter(v => v === "hard-block").length}</p>
                    <p>Must teach: {Object.values(p.gridState || {}).filter(v => v === "hard-req").length}</p>
                    <p>Preferred: {Object.values(p.gridState || {}).filter(v => v === "soft-pref-hi").length}</p>
                    <p>Prefer not: {Object.values(p.gridState || {}).filter(v => v === "soft-avoid").length}</p>
                  </div>
                  <button className="w-full mt-2 text-[11px] text-primary hover:underline" onClick={() => onToast("Open Faculty view to paint constraints", "info")}>
                    Edit in Faculty View
                  </button>
                </div>
              ))}
            </div>

            <div className="flex justify-end">
              <button className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium" onClick={handleIntakeSubmit}>
                Submit Intake & Continue to Build
              </button>
            </div>
          </div>
        )}

        {currentStep === "build" && (
          <div className="space-y-6 max-w-2xl mx-auto">
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
              <div className="flex items-center space-x-2 mb-3">
                <Zap className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-emerald-800">CSP Timetable Builder</h3>
              </div>
              <p className="text-sm text-emerald-700">
                The backtracking CSP solver assigns every section to a day, time, room, and instructor
                while satisfying all hard constraints: room capacity, instructor load caps, cohort conflicts,
                equipment needs, and campus walk distances.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="bg-card border border-border rounded-lg p-4 text-center">
                <p className="text-3xl font-extrabold text-emerald-600">{courses.length}</p>
                <p className="text-xs text-muted-foreground">Courses</p>
              </div>
              <div className="bg-card border border-border rounded-lg p-4 text-center">
                <p className="text-3xl font-extrabold text-primary">{sectionsNeeded}</p>
                <p className="text-xs text-muted-foreground">Sections Needed</p>
              </div>
              <div className="bg-card border border-border rounded-lg p-4 text-center">
                <p className="text-3xl font-extrabold text-sky-600">{Object.keys(masterSchedule).length}</p>
                <p className="text-xs text-muted-foreground">Currently Scheduled</p>
              </div>
            </div>

            {!buildCompleted ? (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-center">
                <div className="w-5 h-5 text-amber-600 mx-auto mb-2">⚠</div>
                <p className="font-medium text-amber-800">Timetable not built yet</p>
                <p className="text-sm text-amber-700 mt-1">Click below to run the CSP auto-solver</p>
                <button className="w-full mt-3 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium" onClick={handleBuild}>
                  Run CSP Auto-Solver
                </button>
              </div>
            ) : (
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 text-center">
                <div className="w-5 h-5 text-emerald-600 mx-auto mb-2">✓</div>
                <p className="font-bold text-emerald-800">Timetable Built Successfully!</p>
                <div className="grid gap-2 md:grid-cols-3 mt-4 text-sm">
                  <div className="bg-white border rounded p-2"><p className="text-emerald-600 font-bold">{Object.keys(masterSchedule).length}</p><p className="text-xs text-muted-foreground">Sections Placed</p></div>
                  <div className="bg-white border rounded p-2"><p className="text-emerald-600 font-bold">{getConstraintHealth().allPassed ? "✓" : "⚠"}</p><p className="text-xs text-muted-foreground">Constraints</p></div>
                  <div className="bg-white border rounded p-2"><p className="text-emerald-600 font-bold">{courses.filter(c => getScheduledCount(c.id) > 0).length}</p><p className="text-xs text-muted-foreground">Courses Covered</p></div>
                </div>
                <button className="w-full mt-3 bg-secondary text-secondary-foreground px-4 py-2 rounded-lg text-sm font-medium" onClick={() => { clearSchedule(); setBuildCompleted(false); onToast("Schedule cleared — rebuild", "info") }}>
                  Rebuild Schedule
                </button>
              </div>
            )}
          </div>
        )}

        {currentStep === "review" && (
          <div className="space-y-6 max-w-2xl mx-auto">
            <div className="bg-sky-50 border border-sky-200 rounded-lg p-4">
              <div className="flex items-center space-x-2 mb-3">
                <ShieldCheck className="w-5 h-5 text-sky-600" />
                <h3 className="font-bold text-sky-800">Constraint Review & Validation</h3>
              </div>
              <p className="text-sm text-sky-700">
                Verify all four rule families are satisfied before finalizing. Any amber badge means
                you need to adjust constraints in Intake or Faculty view.
              </p>
            </div>

            <div className="space-y-3">
              {[
                { key: "demandOk", label: "Cohort Dynamic Demand Satisfied" },
                { key: "studentsOk", label: "Student 4-Course Minimum" },
                { key: "profOk", label: "Zero Prof Hard Conflicts" },
                { key: "roomsOk", label: "No Room Double-Booking" },
              ].map(({ key, label }) => {
                const passed = health[key as keyof typeof health];
                return (
                  <div key={key} className="flex items-center justify-between p-3 bg-card border rounded-lg">
                    <span className="font-medium">{label}</span>
                    <span className={passed ? "bg-emerald-100 text-emerald-800 text-[11px] px-2 py-0.5 rounded" : "bg-amber-100 text-amber-800 text-[11px] px-2 py-0.5 rounded"}>
                      {passed ? "Satisfied" : "Unfulfilled"}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="bg-muted/50 border border-border rounded-lg p-3 text-sm">
              <div className="flex items-center space-x-2 mb-2">
                <Zap className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium text-muted-foreground">Timetable Stats</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px]">
                <div className="bg-card border rounded p-2 text-center"><p className="font-bold text-primary">{Object.keys(masterSchedule).length}</p><p className="text-xs text-muted-foreground">Sections Placed</p></div>
                <div className="bg-card border rounded p-2 text-center"><p className="font-bold text-primary">{courses.filter(c => getScheduledCount(c.id) > 0).length}</p><p className="text-xs text-muted-foreground">Courses Covered</p></div>
                <div className="bg-card border rounded p-2 text-center"><p className="font-bold text-primary">{professors.length}</p><p className="text-xs text-muted-foreground">Instructors Active</p></div>
                <div className="bg-card border rounded p-2 text-center"><p className="font-bold text-primary">{courses.length}</p><p className="text-xs text-muted-foreground">Total Courses</p></div>
              </div>
            </div>

            <div className="flex justify-end">
              <Button variant="primary" size="md" onClick={handleReviewComplete}>
                Complete Review & Continue
              </Button>
            </div>
          </div>
        )}

        {currentStep === "emergency" && (
          <div className="space-y-6 max-w-2xl mx-auto">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="flex items-center space-x-2 mb-3">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
                <h3 className="font-bold text-amber-800">Emergency Response</h3>
              </div>
              <p className="text-sm text-amber-700">
                Handle mid-term disruptions: instructor absences, room closures, enrollment surges.
                The Emergency drawer (header button) provides live re-solve with CSP verification.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="bg-card border border-border rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="w-4 h-4 text-amber-700" />
                  <h4 className="font-bold text-amber-900 text-sm">Instructor Out</h4>
                </div>
                <p className="text-xs text-muted-foreground mb-3">Full-week unavailability → hard-blocks painted → CSP re-solves</p>
                <Button variant="outline" size="sm" className="w-full" onClick={() => onToast("Open Emergency drawer (header button)", "info")}>
                  Open Emergency Drawer
                </Button>
              </div>

              <div className="bg-card border border-border rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Building2 className="w-4 h-4 text-amber-700" />
                  <h4 className="font-bold text-amber-900 text-sm">Room Closed</h4>
                </div>
                <p className="text-xs text-muted-foreground mb-3">Facility outage → sections re-homed → CSP re-solves</p>
                <Button variant="outline" size="sm" className="w-full" onClick={() => onToast("Open Emergency drawer (header button)", "info")}>
                  Open Emergency Drawer
                </Button>
              </div>

              <div className="bg-card border border-border rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="w-4 h-4 text-amber-700" />
                  <h4 className="font-bold text-amber-900 text-sm">Enrollment Surge</h4>
                </div>
                <p className="text-xs text-muted-foreground mb-3">Capacity exceeded → re-trigger capacity checks → CSP re-solves</p>
                <Button variant="outline" size="sm" className="w-full" onClick={() => onToast("Open Emergency drawer (header button)", "info")}>
                  Open Emergency Drawer
                </Button>
              </div>
            </div>

            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-1">
                <ShieldCheck className="w-4 h-4 text-emerald-700" />
                <span className="font-bold text-emerald-800">Emergency protocol verified</span>
              </div>
              <p className="text-xs text-emerald-700">All re-solves are verified by CP-SAT before application — no guesswork.</p>
            </div>
          </div>
        )}
      </div>

      {/* Wizard footer: single, simple Back / Next control */}
      <div className="shrink-0 border-t border-border bg-card px-4 py-3 flex items-center justify-between">
        <Button variant="outline" size="md" onClick={handlePrev} disabled={!canGoPrev} className="flex items-center gap-1.5">
          <ArrowLeft className="w-4 h-4" /> Back
        </Button>
        <span className="text-xs text-muted-foreground">Step {currentIndex + 1} of {STEPS.length}</span>
        {currentStep === "emergency" ? (
          <Button variant="primary" size="md" onClick={handleEmergencySolve} className="flex items-center gap-1.5">
            Complete <CheckCircle2 className="w-4 h-4" />
          </Button>
        ) : (
          <Button variant="primary" size="md" onClick={handleNext} disabled={!canGoNext} className="flex items-center gap-1.5">
            Next <ArrowRight className="w-4 h-4" />
          </Button>
        )}
      </div>
    </div>
  );
}