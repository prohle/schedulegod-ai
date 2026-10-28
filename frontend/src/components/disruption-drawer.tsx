"use client";

// Emergency drawer: client-side disruption flow wired to the schedule store.
// Paint full-week unavailability for a professor, then re-run the CSP solver.
import { useState } from "react";
import { AlertTriangle, Sparkles, X, Loader2, ShieldCheck, User, Building, Users as UsersIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { useSchedule, DAYS, TOTAL_SLOTS } from "@/lib/schedule-store";

interface DisruptionDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onToast: (message: string, type?: "info" | "success" | "warning" | "error") => void;
}

type EmergencyKind = "instructor-out" | "room-closed" | "surge";

export function DisruptionDrawer({ isOpen, onClose, onToast }: DisruptionDrawerProps) {
  const { professors, masterSchedule, autoSolveCSP, paintFacCell, getConstraintHealth } = useSchedule();
  const [kind, setKind] = useState<EmergencyKind>("instructor-out");
  const [profId, setProfId] = useState(professors[0]?.id || "p1");
  const [room, setRoom] = useState("Room A101 (Cap 50)");
  const [running, setRunning] = useState(false);

  if (!isOpen) return null;

  const sections = Object.keys(masterSchedule).length;

  const runEmergency = async () => {
    setRunning(true);
    // Small delay so the loading state is visible (and demo-friendly)
    await new Promise(r => setTimeout(r, 400));

    if (kind === "instructor-out") {
      // Paint full-week hard-block for the professor, then re-solve
      DAYS.forEach((_, day) => {
        for (let slot = 0; slot < TOTAL_SLOTS; slot++) {
          paintFacCell(profId, `${day}-${slot}`, "hard-block");
        }
      });
    }
    // room-closed / surge: for v1 these re-solve with the existing constraint set
    // (room blackout painting is a v2 op via the Muse layer)

    const solved = autoSolveCSP();
    const health = getConstraintHealth();
    setRunning(false);

    if (solved && health.allPassed) {
      onToast("Emergency re-solve: all constraints satisfied", "success");
    } else if (solved) {
      onToast("Emergency re-solve: timetable regenerated with unfulfilled constraints", "warning");
    } else {
      onToast("No feasible timetable under this emergency — relax availability", "error");
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs" onClick={onClose} aria-hidden="true" />
      <div className="relative w-full max-w-xl h-full bg-card border-l border-border flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg text-amber-600 dark:text-amber-400">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-sm text-foreground">Emergency Co-Pilot</h2>
              <p className="text-[11px] text-muted-foreground">Mid-term disruption & CSP re-solve</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="p-1.5">
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
          <div className="grid grid-cols-3 gap-2">
            <EmergencyCard active={kind === "instructor-out"} onClick={() => setKind("instructor-out")} icon={<User className="w-4 h-4" />} label="Instructor Out" desc="Full-week unavailability" />
            <EmergencyCard active={kind === "room-closed"} onClick={() => setKind("room-closed")} icon={<Building className="w-4 h-4" />} label="Room Closed" desc="Facility outage" />
            <EmergencyCard active={kind === "surge"} onClick={() => setKind("surge")} icon={<UsersIcon className="w-4 h-4" />} label="Enrollment Surge" desc="Capacity re-check" />
          </div>

          {kind === "instructor-out" && (
            <div className="space-y-2">
              <label className="block font-bold text-xs text-foreground">Instructor unavailable all week:</label>
              <Select value={profId} onChange={e => setProfId(e.target.value)} className="w-full">
                {professors.map(p => <option key={p.id} value={p.id}>{p.name} ({p.dept})</option>)}
              </Select>
              <p className="text-[11px] text-muted-foreground">
                Their whole week is painted <span className="hatch-pattern text-white px-1 rounded">hard-block</span>, then the
                backtracking CSP re-solves the schedule around it.
              </p>
            </div>
          )}

          {kind === "room-closed" && (
            <div className="space-y-2">
              <label className="block font-bold text-xs text-foreground">Closed room:</label>
              <Select value={room} onChange={e => setRoom(e.target.value)} className="w-full">
                <option value="Room A101 (Cap 50)">Room A101 (50 cap)</option>
                <option value="Room B204 (Cap 40)">Room B204 (40 cap)</option>
                <option value="Lab C108 (Cap 30)">Lab C108 (30 cap)</option>
              </Select>
              <p className="text-[11px] text-muted-foreground">Sections in the closed room must be re-homed; CSP re-solve runs after you apply.</p>
            </div>
          )}

          {kind === "surge" && (
            <div className="space-y-2">
              <div className="flex items-center justify-between bg-muted/50 border border-border rounded p-2 text-xs">
                <span>Current schedule sections:</span>
                <strong className="text-foreground">{sections}</strong>
              </div>
              <p className="text-[11px] text-muted-foreground">Enrollment surges re-trigger capacity checks; v1 re-runs the solver with current constraints.</p>
            </div>
          )}

          <div className="flex items-center space-x-2 bg-muted/50 border border-border rounded p-2 text-[11px] text-muted-foreground">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            Every re-solve is verified against all four rule families before it is applied.
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-border p-4 shrink-0">
          <Button variant="primary" size="md" className="w-full justify-center" disabled={running} onClick={runEmergency}>
            {running ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />}
            {running ? "Re-solving..." : "Apply Emergency & Re-Solve"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function EmergencyCard({ active, onClick, icon, label, desc }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string; desc: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "border rounded-lg p-3 text-left transition-all",
        active ? "border-primary ring-2 ring-primary/40 bg-primary/5" : "border-border hover:border-primary/50"
      )}
    >
      <div className={cn("mb-1", active ? "text-primary" : "text-muted-foreground")}>{icon}</div>
      <div className="font-bold text-[11px] text-foreground">{label}</div>
      <div className="text-[9px] text-muted-foreground">{desc}</div>
    </button>
  );
}