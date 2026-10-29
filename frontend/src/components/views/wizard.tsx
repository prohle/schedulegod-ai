"use client";

// Guided wizard — the real end-to-end flow, no toy solver. Every step hits the
// Python backend: Muse Spark parse, CP-SAT solve, the C39/spectral audit, and
// verified emergency coverage proposals. The default inputs are the demo beats.

import { useState } from "react";
import {
  ArrowLeft, ArrowRight, CheckCircle2, ShieldCheck, AlertTriangle, Zap,
  Users, Loader2, CircleCheck, CircleX, Sparkles, Wrench, Radar, Database,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useIntelligence } from "@/hooks/use-api";
import {
  DAY_NAMES, PERIOD_NAMES, PATTERN_DAYS,
  type Placement, type CopilotResponse, type EmergencyResponse, type IngestResponse,
} from "@/types";

interface WizardViewProps {
  onToast: (message: string, type?: "info" | "success" | "warning" | "error") => void;
}

const STEPS = [
  { id: "import", label: "Import", desc: "Point the tool at your data — AI autocleans it", icon: Database },
  { id: "intake", label: "Intake", desc: "Type a constraint → Muse parses it", icon: Users },
  { id: "build", label: "Build", desc: "Run the CP-SAT solver", icon: Zap },
  { id: "review", label: "Review", desc: "C39 audit + spectral radar", icon: ShieldCheck },
  { id: "emergency", label: "Emergency", desc: "Coverage proposals + re-solve", icon: AlertTriangle },
] as const;

type StepId = (typeof STEPS)[number]["id"];

const SAMPLE_DUMP = `Course catalog:
CS 101 Intro to Programming — MWF, lecture, 50 seats, projector
MATH 201 Calculus I — MWF, lecture, 45 seats, projector
CS 201 Data Structures — MWF, lecture, 45 seats, projector
CS 210 Systems Lab — block, lab, 26 seats, computers
CS 301 Algorithms — MWF, lecture, 26 seats, whiteboard
CS 310 Operating Systems — TTh, lecture, 25 seats, lecture-capture
CS 350 Machine Learning — MWF, lecture, 26 seats
CS 401 Capstone — MWF, seminar, 25 seats, video-conf

Faculty:
Dr. Chen teaches CS 301, CS 310
Prof. Patel teaches CS 101, MATH 201
Dr. Diaz teaches CS 101, MATH 201, CS 201
Dr. Okafor teaches CS 201, CS 301, CS 350 (max 3 sections)
Prof. Lee teaches CS 210, CS 401
Dr. Nguyen teaches CS 310, CS 401, CS 301, CS 350

Degree map (BSc Computer Science):
term 1: CS 101 (required)
term 3: CS 201 (required), MATH 201 (required)
term 5: CS 210 (required), CS 301 (required), CS 350 (elective)
term 7: CS 310 (required), CS 401 (required)

Cohorts:
CS 2026 (class of 2030), term 1, 50 students
CS 2025 (class of 2029), term 3, 45 students
CS 2024 (class of 2028), term 5, 26 students
CS 2023 (class of 2027), term 7, 25 students

Rooms:
Science Hall 120 — 120 seats, lecture, projector, lecture-capture
Science 101 — 36 seats, lecture, whiteboard
Science 102 — 40 seats, lecture
Science Lab 1 — 30 seats, lab, computers
Engineering 201 — 45 seats, lecture, projector
Engineering Lab 2 — 28 seats, lab, computers
Library Seminar — 30 seats, seminar, video-conf`;

function placementSlot(p: Placement): string {
  if (p.period != null) {
    const pattern = PATTERN_DAYS.MWF.includes(p.days[0]) && p.days.length === 3 ? "MWF" : "TTh";
    return `${pattern} @${PERIOD_NAMES[p.period]}`;
  }
  const day = DAY_NAMES[p.days[0]]?.slice(0, 3) ?? "?";
  return `${day} @${PERIOD_NAMES[p.periods[0]]}-${PERIOD_NAMES[p.periods[1] ?? p.periods[0]]}`;
}

function PlacementsTable({ placements, dense }: { placements: Placement[]; dense?: boolean }) {
  return (
    <div className="overflow-x-auto border border-border rounded-lg">
      <table className="w-full text-xs">
        <thead className="bg-muted text-muted-foreground">
          <tr>
            <th className="text-left px-3 py-1.5 font-semibold">Course</th>
            <th className="text-left px-3 py-1.5 font-semibold">Instructor</th>
            <th className="text-left px-3 py-1.5 font-semibold">Room</th>
            <th className="text-left px-3 py-1.5 font-semibold">Slot</th>
          </tr>
        </thead>
        <tbody>
          {placements.map((p) => (
            <tr key={p.section_id} className="border-t border-border">
              <td className={cn("px-3 py-1.5 font-semibold text-foreground", dense && "py-1")}>{p.course_code}</td>
              <td className={cn("px-3 py-1.5 text-muted-foreground", dense && "py-1")}>{p.instructor_name}</td>
              <td className={cn("px-3 py-1.5 text-muted-foreground", dense && "py-1")}>{p.room_name} <span className="text-[10px]">[{p.building_id}]</span></td>
              <td className={cn("px-3 py-1.5 font-mono text-muted-foreground", dense && "py-1")}>{placementSlot(p)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Section({ title, icon, children, tone = "default" }: {
  title: string; icon: React.ReactNode; children: React.ReactNode;
  tone?: "default" | "primary" | "emerald" | "amber" | "sky";
}) {
  const tones = {
    default: "bg-card border-border", primary: "bg-primary/5 border-primary/20",
    emerald: "bg-emerald-50 border-emerald-200", amber: "bg-amber-50 border-amber-200",
    sky: "bg-sky-50 border-sky-200",
  };
  return (
    <section className={cn("border rounded-lg p-4", tones[tone])}>
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <h3 className="font-bold text-sm text-foreground">{title}</h3>
      </div>
      {children}
    </section>
  );
}

export function WizardView({ onToast }: WizardViewProps) {
  const { margins, spectral, solveResult, busy, error, runSolve } = useIntelligence();
  const [step, setStep] = useState<StepId>("import");
  const [importText, setImportText] = useState(SAMPLE_DUMP);
  const [ingestBusy, setIngestBusy] = useState(false);
  const [ingest, setIngest] = useState<IngestResponse | null>(null);
  const [intakeMsg, setIntakeMsg] = useState("Prof. Patel can't teach Mondays — committee duty. She'd rather not teach at 8:00.");
  const [intakeBusy, setIntakeBusy] = useState(false);
  const [copilot, setCopilot] = useState<CopilotResponse | null>(null);
  const [emergencyMsg, setEmergencyMsg] = useState("Dr. Chen is out all week — who could cover her sections?");
  const [emergencyBusy, setEmergencyBusy] = useState(false);
  const [emergency, setEmergency] = useState<EmergencyResponse | null>(null);

  const stepOrder: StepId[] = ["import", "intake", "build", "review", "emergency"];
  const currentIndex = stepOrder.indexOf(step);

  const post = async (path: string, body: unknown) =>
    (await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })).json();

  const handleImport = async () => {
    setIngestBusy(true);
    try {
      const r: IngestResponse = await post("/api/ingest", { text: importText });
      setIngest(r);
      const p = r.parsed;
      onToast(`Auto-cleaned: ${p.courses.length} courses, ${p.instructors.length} instructors, ${p.cohorts.length} cohorts, ${p.rooms.length} rooms`, "success");
    } finally {
      setIngestBusy(false);
    }
  };

  const handleIntake = async () => {
    setIntakeBusy(true);
    try {
      const r: CopilotResponse = await post("/api/copilot", { message: intakeMsg });
      setCopilot(r);
      if (r.result?.status === "infeasible") onToast("Infeasible — the solver named the conflict and self-healed", "warning");
      else onToast("Muse parsed it; CP-SAT re-solved", "success");
    } finally {
      setIntakeBusy(false);
    }
  };

  const handleEmergency = async () => {
    setEmergencyBusy(true);
    try {
      const r: EmergencyResponse = await post("/api/emergency", { message: emergencyMsg });
      setEmergency(r);
      onToast(`Emergency handled — ${Object.keys(r.chosen).length} section(s) re-homed`, "success");
    } finally {
      setEmergencyBusy(false);
    }
  };

  const buildPlacements = solveResult?.timetable?.placements ?? [];
  const intakePlacements = copilot?.result?.timetable?.placements ?? buildPlacements;

  return (
    <div className="h-full w-full flex flex-col">
      {/* Step header */}
      <div className="bg-card border-b border-border px-4 py-3 shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-extrabold text-lg text-foreground">Guided Wizard</h2>
            <p className="text-sm text-muted-foreground">Intake → Build → Review → Emergency (live backend)</p>
          </div>
          <div className="flex items-center space-x-1">
            {STEPS.map((s, idx) => (
              <div key={s.id} className="flex items-center">
                <div className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all",
                  idx < currentIndex ? "bg-emerald-500 text-white" :
                  idx === currentIndex ? "bg-primary text-white ring-2 ring-primary ring-offset-2" :
                  "bg-muted text-muted-foreground"
                )}>
                  {idx < currentIndex ? <CheckCircle2 className="w-4 h-4" /> : <span>{idx + 1}</span>}
                </div>
                {idx < STEPS.length - 1 && (
                  <div className={cn("w-14 h-1 mx-1 rounded", idx < currentIndex ? "bg-emerald-500" : "bg-muted")} />
                )}
              </div>
            ))}
          </div>
        </div>
        <div className="text-sm text-muted-foreground">
          <span className="font-medium">Step {currentIndex + 1} of {STEPS.length}</span> — {STEPS.find((s) => s.id === step)?.desc}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {error && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
            Backend not reachable — the wizard needs the Python service. Start it with{" "}
            <code className="bg-white px-1 rounded">docker compose up</code> or{" "}
            <code className="bg-white px-1 rounded">./start.sh</code>.
          </div>
        )}

        {step === "import" && (
          <div className="space-y-4 max-w-3xl mx-auto">
            <Section title="Point the tool at your data" icon={<Database className="w-5 h-5 text-primary" />} tone="primary">
              <p className="text-sm text-muted-foreground mb-3">
                Paste your course catalog, degree maps, cohorts, faculty, and facilities — in whatever messy
                shape they arrive. Muse Spark autocleans it into the structured model; the normalizer assembles
                the scenario; CP-SAT schedules; the audit trail monitors.
              </p>
              <textarea
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                rows={16}
                spellCheck={false}
                className="w-full border border-input rounded-lg p-2 text-xs font-mono bg-background"
              />
              <Button variant="primary" size="md" onClick={handleImport} disabled={ingestBusy} className="mt-3 flex items-center gap-2">
                {ingestBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                Auto-clean & Prepare
              </Button>
            </Section>

            {ingest && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className={cn("px-2 py-0.5 rounded font-bold uppercase", ingest.parser_mode === "muse-spark" ? "bg-sky-100 text-sky-800" : "bg-muted")}>
                    {ingest.parser_mode}
                  </span>
                  {ingest.parsed.summary || "Data prepared."}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    ["Courses", ingest.parsed.courses.length],
                    ["Instructors", ingest.parsed.instructors.length],
                    ["Cohorts", ingest.parsed.cohorts.length],
                    ["Rooms", ingest.parsed.rooms.length],
                  ].map(([label, n]) => (
                    <div key={String(label)} className="bg-card border border-border rounded-lg p-3 text-center">
                      <div className="text-xl font-extrabold text-primary">{n}</div>
                      <div className="text-[11px] text-muted-foreground">{label}</div>
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {ingest.parsed.courses.map((c) => (
                    <span key={c.code} className="px-2 py-0.5 bg-muted rounded text-[11px] font-mono">{c.code}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {step === "intake" && (
          <div className="space-y-4 max-w-3xl mx-auto">
            <Section title="Instructor intake (natural language)" icon={<Users className="w-5 h-5 text-primary" />} tone="primary">
              <p className="text-sm text-muted-foreground mb-3">
                Type a constraint exactly as a coordinator would. Muse Spark parses it into typed operations;
                CP-SAT re-solves and proves feasibility.
              </p>
              <textarea
                value={intakeMsg}
                onChange={(e) => setIntakeMsg(e.target.value)}
                rows={2}
                className="w-full border border-input rounded-lg p-2 text-sm bg-background"
              />
              <Button variant="primary" size="md" onClick={handleIntake} disabled={intakeBusy} className="mt-3 flex items-center gap-2">
                {intakeBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                Parse & Re-solve
              </Button>
            </Section>

            {copilot && (
              <>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className={cn("px-2 py-0.5 rounded font-bold uppercase", copilot.parser_mode === "muse-spark" ? "bg-sky-100 text-sky-800" : "bg-muted")}>
                    {copilot.parser_mode}
                  </span>
                  {copilot.summary}
                </div>
                {copilot.operations.map((op, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs bg-card border border-border rounded p-2">
                    <CircleCheck className="w-3.5 h-3.5 text-emerald-600 mt-0.5 shrink-0" />
                    <span className="font-mono font-semibold">{op.op}</span>
                    <span className="text-muted-foreground">{op.explanation}</span>
                  </div>
                ))}
                {copilot.diagnosis && (
                  <div className="bg-amber-50 border border-amber-200 rounded p-3 text-xs text-amber-800">
                    <strong>Diagnosis ({copilot.diagnosis_mode}):</strong> {copilot.diagnosis}
                  </div>
                )}
                {intakePlacements.length > 0 && <PlacementsTable placements={intakePlacements} dense />}
              </>
            )}
          </div>
        )}

        {step === "build" && (
          <div className="space-y-4 max-w-3xl mx-auto">
            <Section title="Build the term" icon={<Zap className="w-5 h-5 text-emerald-600" />} tone="emerald">
              <p className="text-sm text-emerald-700 mb-3">
                The OR-Tools CP-SAT solver assigns every section an instructor, timeslot set, and room under all
                hard constraints — capacity, loads, cohort conflicts, equipment, walk distances.
              </p>
              <Button variant="primary" size="md" onClick={() => { runSolve(); onToast("Running CP-SAT…", "info"); }} disabled={busy !== null} className="flex items-center gap-2">
                {busy === "solve" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                Solve
              </Button>
            </Section>
            {solveResult && solveResult.status !== "infeasible" && (
              <div className="flex items-center gap-4 flex-wrap text-xs text-muted-foreground">
                <span className="font-bold text-emerald-600">{solveResult.status.toUpperCase()}</span>
                <span>{solveResult.solve_time_ms} ms</span>
                <span>penalty {solveResult.objective ?? "—"}</span>
              </div>
            )}
            {buildPlacements.length > 0 && <PlacementsTable placements={buildPlacements} />}
          </div>
        )}

        {step === "review" && (
          <div className="space-y-4 max-w-3xl mx-auto">
            {spectral && (
              <Section title="Spectral radar" icon={<Radar className="w-5 h-5 text-sky-600" />} tone="sky">
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="bg-white border rounded p-2">
                    <div className="font-bold text-foreground">{spectral.algebraic_connectivity.toFixed(3)}</div>
                    <div className="text-muted-foreground">connectivity μ₂</div>
                  </div>
                  <div className="bg-white border rounded p-2">
                    <div className="font-bold text-foreground">χ ≥ {spectral.hoffman_chromatic_lower_bound}</div>
                    <div className="text-muted-foreground">Hoffman bound</div>
                  </div>
                  <div className="bg-white border rounded p-2">
                    <div className="font-bold text-foreground">{spectral.max_clique.length}</div>
                    <div className="text-muted-foreground">max clique</div>
                  </div>
                </div>
                {spectral.deadlock_warnings.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {spectral.deadlock_warnings.map((w, i) => (
                      <li key={i} className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded p-1.5">{w}</li>
                    ))}
                  </ul>
                )}
              </Section>
            )}

            {margins && (
              <Section title={`Four-course guarantee (C39) — min ${margins.min_courses}`} icon={<ShieldCheck className="w-5 h-5 text-emerald-600" />} tone="emerald">
                <div className="space-y-2">
                  {margins.cohorts.map((m) => (
                    <div key={m.cohort_id} className={cn("border rounded-lg p-2.5", m.ok ? "bg-white border-emerald-200" : "bg-amber-50 border-amber-200")}>
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-sm">{m.name}</span>
                        <span className={cn("text-xs font-bold px-2 py-0.5 rounded", m.ok ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800")}>
                          {m.margin} / {margins.min_courses}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {m.example_track.map((c) => (
                          <span key={c} className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">{c}</span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </Section>
            )}
          </div>
        )}

        {step === "emergency" && (
          <div className="space-y-4 max-w-3xl mx-auto">
            <Section title="Emergency response" icon={<AlertTriangle className="w-5 h-5 text-amber-600" />} tone="amber">
              <p className="text-sm text-amber-700 mb-3">
                An instructor drops out. The co-pilot probes every qualified instructor with CP-SAT and ranks the
                zero-ripple swaps — the solver proves who can cover before any name is shown.
              </p>
              <textarea
                value={emergencyMsg}
                onChange={(e) => setEmergencyMsg(e.target.value)}
                rows={2}
                className="w-full border border-input rounded-lg p-2 text-sm bg-background"
              />
              <Button variant="primary" size="md" onClick={handleEmergency} disabled={emergencyBusy} className="mt-3 flex items-center gap-2">
                {emergencyBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wrench className="w-4 h-4" />}
                Handle Emergency
              </Button>
            </Section>

            {emergency && (
              <>
                <div className="text-xs text-muted-foreground">
                  {emergency.removed_instructor_name} removed — {emergency.affected_section_ids.length} section(s) affected
                  {emergency.parser_mode === "muse-spark" ? " · live Muse Spark" : " · mock parser"}
                </div>
                {emergency.proposals.map((p, i) => (
                  <div key={i} className={cn("flex items-center gap-2 text-xs border rounded p-2", p.feasible ? "bg-white border-emerald-200" : "bg-muted/40 border-border")}>
                    {p.feasible ? <CircleCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> : <CircleX className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
                    <span className="font-semibold">{p.course_code}</span>
                    <span>→ {p.instructor_name}</span>
                    <span className="text-muted-foreground flex-1">{p.reason}</span>
                  </div>
                ))}
                {emergency.result?.timetable?.placements?.length ? (
                  <PlacementsTable placements={emergency.result.timetable.placements} dense />
                ) : null}
              </>
            )}
          </div>
        )}
      </div>

      {/* Footer nav */}
      <div className="shrink-0 border-t border-border bg-card px-4 py-3 flex items-center justify-between">
        <Button variant="outline" size="md" onClick={() => setStep(stepOrder[Math.max(0, currentIndex - 1)])} disabled={currentIndex === 0} className="flex items-center gap-1.5">
          <ArrowLeft className="w-4 h-4" /> Back
        </Button>
        <span className="text-xs text-muted-foreground">Step {currentIndex + 1} of {STEPS.length}</span>
        {currentIndex < stepOrder.length - 1 ? (
          <Button variant="primary" size="md" onClick={() => setStep(stepOrder[currentIndex + 1])} className="flex items-center gap-1.5">
            Next <ArrowRight className="w-4 h-4" />
          </Button>
        ) : (
          <Button variant="primary" size="md" onClick={() => onToast("Schedule stable — audit trail recorded", "success")} className="flex items-center gap-1.5">
            Complete <CheckCircle2 className="w-4 h-4" />
          </Button>
        )}
      </div>
    </div>
  );
}