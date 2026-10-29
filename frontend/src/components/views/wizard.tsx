"use client";

// Guided wizard — the real end-to-end flow, no toy solver. Every step hits the
// Python backend: Muse Spark parse, CP-SAT solve, the C39/spectral audit, and
// verified emergency coverage proposals. The default inputs are the demo beats.

import { useRef, useState } from "react";
import {
  ArrowLeft, ArrowRight, CheckCircle2, ShieldCheck, AlertTriangle, Zap,
  Users, Loader2, CircleCheck, CircleX, Sparkles, Wrench, Radar, Database,
  UploadCloud, FileText, X, ListChecks, Mic, Square, Upload,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { TimetableGrid, changedSections } from "@/components/timetable-grid";
import { blobToWav } from "@/lib/audio";
import { useIntelligence, useScenario } from "@/hooks/use-api";
import {
  DAY_NAMES, PERIOD_NAMES, PATTERN_DAYS,
  type Placement, type CopilotResponse, type EmergencyResponse, type IngestResponse,
  type InstitutionData,
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

type ReviewSection = [string, keyof InstitutionData, (x: any) => string];

const REVIEW_SECTIONS: ReviewSection[] = [
  ["Courses", "courses", (x) => `${x?.code ?? "?"} · ${x?.title ?? ""}`],
  ["Faculty", "instructors", (x) => x?.name ?? "?"],
  ["Cohorts", "cohorts", (x) => `${x?.name ?? "?"} (${x?.size ?? 0})`],
  ["Facilities", "rooms", (x) => `${x?.name ?? "?"} (${x?.capacity ?? 0})`],
  ["Degree map", "degree_map", (x) => `${x?.course ?? "?"} · term ${x?.term ?? "?"}`],
  ["Buildings", "buildings", (x) => x],
];

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
Dr. Diaz teaches CS 101, MATH 201, CS 201 — unavailable Fridays; prefers mornings
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
Library Seminar — 30 seats, seminar, video-conf

Campus map:
Science, Engineering, Library
Science to Engineering: 8 min
Science to Library: 6 min
Engineering to Library: 9 min`;

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
            <th className="text-right px-3 py-1.5 font-semibold">Length</th>
          </tr>
        </thead>
        <tbody>
          {placements.map((p) => (
            <tr key={p.section_id} className="border-t border-border">
              <td className={cn("px-3 py-1.5 font-semibold text-foreground", dense && "py-1")}>{p.course_code}</td>
              <td className={cn("px-3 py-1.5 text-muted-foreground", dense && "py-1")}>{p.instructor_name}</td>
              <td className={cn("px-3 py-1.5 text-muted-foreground", dense && "py-1")}>{p.room_name} <span className="text-[10px]">[{p.building_id}]</span></td>
              <td className={cn("px-3 py-1.5 font-mono text-muted-foreground", dense && "py-1")}>{placementSlot(p)}</td>
              <td className={cn("px-3 py-1.5 text-right font-mono text-muted-foreground", dense && "py-1")}>{p.duration ?? 1.5}h</td>
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
  const { margins, spectral, solveResult, busy, error, runSolve, reload } = useIntelligence();
  const { scenario: currentScenario } = useScenario();
  const [step, setStep] = useState<StepId>("import");
  const [importText, setImportText] = useState(SAMPLE_DUMP);
  const [files, setFiles] = useState<File[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [ingestBusy, setIngestBusy] = useState(false);
  const [ingest, setIngest] = useState<IngestResponse | null>(null);
  const [edited, setEdited] = useState<InstitutionData | null>(null);
  const [intakeMsg, setIntakeMsg] = useState("Prof. Patel can't teach Mondays — committee duty. She'd rather not teach at 8:00.");
  const [speakerId, setSpeakerId] = useState("");
  const [intakeBusy, setIntakeBusy] = useState(false);
  const [copilot, setCopilot] = useState<CopilotResponse | null>(null);
  const [emergencyMsg, setEmergencyMsg] = useState("Dr. Chen is out all week — who could cover her sections?");
  const [emergencyBusy, setEmergencyBusy] = useState(false);
  const [emergency, setEmergency] = useState<EmergencyResponse | null>(null);
  const [voiceBusy, setVoiceBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const stepOrder: StepId[] = ["import", "intake", "build", "review", "emergency"];
  const currentIndex = stepOrder.indexOf(step);

  const post = async (path: string, body: unknown) =>
    (await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })).json();

  const addFiles = (incoming: FileList | File[]) => {
    setFiles((prev) => [...prev, ...Array.from(incoming)]);
  };

  const handleImportFiles = async () => {
    if (files.length === 0) return;
    setIngestBusy(true);
    try {
      const fd = new FormData();
      files.forEach((f) => fd.append("files", f, f.name));
      const r: IngestResponse = await (await fetch("/api/ingest/files", { method: "POST", body: fd })).json();
      setIngest(r);
      setEdited(JSON.parse(JSON.stringify(r.parsed)));
      if (r.completeness.complete) onToast("All six inputs present — ready to build", "success");
      else onToast(`Missing: ${r.completeness.missing.join(", ")}`, "warning");
    } finally {
      setIngestBusy(false);
    }
  };

  const handleImport = async () => {
    setIngestBusy(true);
    try {
      const r: IngestResponse = await post("/api/ingest", { text: importText });
      setIngest(r);
      setEdited(JSON.parse(JSON.stringify(r.parsed)));
      if (r.completeness.complete) onToast("All six inputs present — ready to build", "success");
      else onToast(`Missing: ${r.completeness.missing.join(", ")}`, "warning");
    } finally {
      setIngestBusy(false);
    }
  };

  const removeEntity = (field: keyof InstitutionData, index: number) => {
    setEdited((prev) => {
      if (!prev) return prev;
      const arr = (prev[field] as unknown[]).filter((_, i) => i !== index);
      return { ...prev, [field]: arr };
    });
  };

  const keepAll = () => setEdited(ingest ? JSON.parse(JSON.stringify(ingest.parsed)) : null);

  const removeInvalid = () => {
    setEdited((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        courses: prev.courses.filter((c) => c.code && c.seats > 0),
        instructors: prev.instructors.filter((i) => i.name && i.qualified_courses.length > 0),
        rooms: prev.rooms.filter((r) => r.name && r.capacity > 0),
        cohorts: prev.cohorts.filter((c) => c.name && c.size > 0),
      };
    });
  };

  const localCompleteness = (d: InstitutionData | null) => {
    if (!d) return null;
    const defs: [string, string, keyof InstitutionData][] = [
      ["degree_catalog", "Degree catalog", "courses"],
      ["degree_maps", "Degree maps", "degree_map"],
      ["student_bodies", "Student bodies", "cohorts"],
      ["faculty", "Faculty availability", "instructors"],
      ["facilities", "Facilities", "rooms"],
      ["campus_map", "Campus map", "buildings"],
    ];
    return defs.map(([key, label, field]) => {
      const count = (d[field] as unknown[]).length;
      return { key, label, provided: count > 0, count };
    });
  };

  const handleNext = async () => {
    if (currentIndex >= stepOrder.length - 1) return;
    // Leaving Import: finalize the reviewed (keep/changed) data so the solver
    // builds from exactly what the user kept.
    if (step === "import" && edited) {
      setIngestBusy(true);
      try {
        const r: IngestResponse = await post("/api/ingest/apply", { data: edited });
        setIngest(r);
        // The intelligence panel must reflect the world we just imported,
        // not the seed it loaded when the wizard mounted.
        await reload();
      } finally {
        setIngestBusy(false);
      }
    }
    setStep(stepOrder[currentIndex + 1]);
  };

  const handleIntake = async () => {
    setIntakeBusy(true);
    try {
      const r: CopilotResponse = await post("/api/copilot", {
        message: intakeMsg,
        speaker_id: speakerId || undefined,
      });
      setCopilot(r);
      if (r.result?.status === "infeasible") {
        onToast("Infeasible — the solver named the conflict and self-healed", "warning");
      } else if (r.applied_operations?.length) {
        // Commit the verified request so Build/Review/Emergency build on it
        // instead of silently reverting to the pre-request world.
        await post("/api/apply", { operations: r.applied_operations });
        await reload();
        onToast("Applied to the term — later steps build on it", "success");
      } else {
        onToast("Muse parsed it; CP-SAT re-solved", "success");
      }
    } finally {
      setIntakeBusy(false);
    }
  };

  const commitEmergency = async (r: EmergencyResponse) => {
    setEmergency(r);
    const rehomed = Object.keys(r.chosen).length;
    const feasible = r.result?.status !== "infeasible";
    if (r.removed_instructor_id && feasible
        && (rehomed > 0 || r.affected_section_ids.length === 0)) {
      // Commit the removal and every verified coverage pick, so a later
      // solve cannot quietly put the absent instructor back on the board.
      await post("/api/apply", {
        pins: r.chosen,
        remove_instructor_id: r.removed_instructor_id,
      });
      await reload();
      onToast(`Emergency applied — ${rehomed} section(s) re-homed`, "success");
    } else {
      onToast(`Emergency analysed — ${rehomed} section(s) re-homed`, "warning");
    }
  };

  const handleEmergency = async () => {
    setEmergencyBusy(true);
    try {
      await commitEmergency(await post("/api/emergency", { message: emergencyMsg }));
    } finally {
      setEmergencyBusy(false);
    }
  };

  const sendVoice = async (file: Blob, name: string) => {
    setVoiceBusy(true);
    try {
      const form = new FormData();
      form.append("file", file, name);
      const res = await fetch("/api/emergency/audio", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        onToast(data.detail || "Voice transcription failed", "error");
        return;
      }
      await commitEmergency(data as EmergencyResponse);
    } finally {
      setVoiceBusy(false);
    }
  };

  const startVoice = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size) chunksRef.current.push(event.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        try {
          await sendVoice(await blobToWav(blob), "voice-note.wav");
        } catch {
          onToast("Could not convert the recording — upload a WAV instead", "error");
        }
      };
      mediaRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch {
      onToast("Microphone unavailable — upload a WAV instead", "warning");
    }
  };

  const stopVoice = () => {
    mediaRef.current?.stop();
    setRecording(false);
  };

  const onVoiceFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) await sendVoice(file, file.name);
    event.target.value = "";
  };

  const buildPlacements = solveResult?.timetable?.placements ?? [];
  const intakePlacements = copilot?.result?.timetable?.placements ?? buildPlacements;
  const emergencyPlacements = emergency?.result?.timetable?.placements ?? [];
  const emergencyBaseline = buildPlacements.length ? buildPlacements : intakePlacements;
  const emergencyChanged = emergencyBaseline.length && emergencyPlacements.length
    ? changedSections(emergencyBaseline, emergencyPlacements)
    : undefined;

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
            <Section title="Drop your scheduling data" icon={<Database className="w-5 h-5 text-primary" />} tone="primary">
              <p className="text-sm text-muted-foreground mb-3">
                Drop a zipped file, one file, or many — degree catalog, degree maps, student bodies, faculty
                availability, facilities, and the campus map. Muse Spark autocleans whatever shape they arrive in.
              </p>

              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files); }}
                onClick={() => document.getElementById("file-input")?.click()}
                className={cn(
                  "border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors",
                  dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
                )}
              >
                <UploadCloud className="w-6 h-6 mx-auto text-muted-foreground" />
                <p className="text-sm font-medium mt-2">Drag &amp; drop files here, or click to browse</p>
                <p className="text-[11px] text-muted-foreground mt-1">.zip · .txt · .csv · .json · .md — one at a time or many</p>
                <input id="file-input" type="file" multiple className="hidden"
                  onChange={(e) => e.target.files && addFiles(e.target.files)} />
              </div>

              {files.length > 0 && (
                <div className="mt-3 space-y-1">
                  {files.map((f, i) => (
                    <div key={`${f.name}-${i}`} className="flex items-center gap-2 text-xs bg-muted/50 border border-border rounded px-2 py-1">
                      <FileText className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <span className="flex-1 truncate">{f.name}</span>
                      <span className="text-muted-foreground">{(f.size / 1024).toFixed(0)} KB</span>
                      <button onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-destructive">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  <Button variant="primary" size="md" onClick={handleImportFiles} disabled={ingestBusy} className="mt-2 flex items-center gap-2">
                    {ingestBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    Process {files.length} file{files.length > 1 ? "s" : ""}
                  </Button>
                </div>
              )}

              <details className="mt-3 text-xs">
                <summary className="text-muted-foreground cursor-pointer">…or paste the data as text</summary>
                <textarea value={importText} onChange={(e) => setImportText(e.target.value)} rows={10} spellCheck={false}
                  className="w-full border border-input rounded-lg p-2 text-[11px] font-mono bg-background mt-2" />
                <Button variant="outline" size="sm" onClick={handleImport} disabled={ingestBusy} className="mt-2">Auto-clean pasted text</Button>
              </details>
            </Section>

            {ingest && edited && (
              <div className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className={cn("px-2 py-0.5 rounded font-bold uppercase", ingest.parser_mode === "muse-spark" ? "bg-sky-100 text-sky-800" : "bg-muted")}>
                      {ingest.parser_mode}
                    </span>
                    {ingest.model && <span className="font-mono">{ingest.model}</span>}
                    {ingest.parser_latency_ms != null && <span>{Math.round(ingest.parser_latency_ms / 100) / 10}s</span>}
                    {(() => {
                      const checks = localCompleteness(edited) ?? [];
                      const missing = checks.filter((c) => !c.provided).map((c) => c.label);
                      return missing.length === 0
                        ? <span className="text-emerald-700 font-semibold">Complete — ready to build the schedule</span>
                        : <span className="text-amber-700 font-semibold">Missing {missing.length}: {missing.join(", ")}</span>;
                    })()}
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {(localCompleteness(edited) ?? []).map((chk) => (
                      <div key={chk.key} className={cn("flex items-center gap-2 border rounded-lg p-2.5", chk.provided ? "bg-emerald-50/40 border-emerald-200" : "bg-amber-50/60 border-amber-200")}>
                        {chk.provided ? <CircleCheck className="w-4 h-4 text-emerald-600 shrink-0" /> : <CircleX className="w-4 h-4 text-amber-600 shrink-0" />}
                        <span className="flex-1">
                          <span className="block text-xs font-medium">{chk.label}</span>
                          <span className="block text-[10px] text-muted-foreground">{chk.provided ? `${chk.count} kept` : "missing"}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <Section title="Review & adjust what to keep" icon={<ListChecks className="w-5 h-5 text-primary" />} tone="default">
                  <div className="flex items-center gap-2 mb-3">
                    <Button variant="outline" size="sm" onClick={keepAll}>Keep all</Button>
                    <Button variant="outline" size="sm" onClick={removeInvalid}>Remove invalid</Button>
                    <span className="text-[11px] text-muted-foreground">remove any row with ✕ — the solver builds only from what you keep</span>
                  </div>

                  {[
                    ["Courses", "courses", (x: { code?: string; title?: string }) => `${x.code ?? "?"} · ${x.title ?? ""}`],
                    ["Faculty", "instructors", (x: { name?: string }) => x.name ?? "?"],
                    ["Cohorts", "cohorts", (x: { name?: string; size?: number }) => `${x.name ?? "?"} (${x.size ?? 0})`],
                    ["Facilities", "rooms", (x: { name?: string; capacity?: number }) => `${x.name ?? "?"} (${x.capacity ?? 0})`],
                    ["Degree map", "degree_map", (x: { course?: string; term?: number }) => `${x.course ?? "?"} · term ${x.term ?? "?"}`],
                    ["Buildings", "buildings", (x: string) => x],
                  ].map((row) => {
                    const [label, field, fmt] = row as unknown as ReviewSection;
                    const items = (edited[field as keyof InstitutionData] as unknown[]) ?? [];
                    if (items.length === 0) return null;
                    return (
                      <div key={String(label)} className="mb-3 last:mb-0">
                        <div className="text-[11px] font-semibold text-muted-foreground mb-1">{label} ({items.length})</div>
                        <div className="flex flex-wrap gap-1.5">
                          {items.map((item, i) => (
                            <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 bg-muted rounded text-[11px] font-mono">
                              {fmt(item)}
                              <button onClick={() => removeEntity(field as keyof InstitutionData, i)} className="text-muted-foreground hover:text-destructive" aria-label={`remove ${label}`}>
                                <X className="w-3 h-3" />
                              </button>
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </Section>
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
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <label className="text-xs font-semibold text-muted-foreground" htmlFor="speaker">Speaker</label>
                <select
                  id="speaker"
                  value={speakerId}
                  onChange={(e) => setSpeakerId(e.target.value)}
                  className="border border-input rounded-lg px-2 py-1 text-xs bg-background"
                >
                  <option value="">(chair / not specified)</option>
                  {(ingest?.scenario.instructors ?? currentScenario?.instructors ?? []).map((i) => (
                    <option key={i.id} value={i.id}>{i.name}</option>
                  ))}
                </select>
                <span className="text-[10px] text-muted-foreground">
                  Needed for “I can’t…” / “keep me…” requests.
                </span>
              </div>
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
                  {copilot.model && <span className="font-mono">{copilot.model}</span>}
                  {copilot.parser_latency_ms != null && <span>{Math.round(copilot.parser_latency_ms / 100) / 10}s</span>}
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
                {copilot.options.length > 0 && (
                  <Section title="Solver-verified resolutions" icon={<ShieldCheck className="w-5 h-5 text-emerald-600" />} tone="emerald">
                    <p className="text-xs text-emerald-800 mb-2">
                      Muse proposed each fix; CP-SAT re-solved it. Only proven options are shown — the least disruptive one was applied to the term.
                    </p>
                    <div className="space-y-1.5">
                      {copilot.options.map((o, i) => (
                        <div key={i} className="bg-white border border-emerald-200 rounded p-2 text-xs">
                          <div className="flex items-center gap-2">
                            <CircleCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <span className="font-semibold">Drop</span>
                            <span className="text-muted-foreground">{o.dropped_explanation}</span>
                            <span className="ml-auto font-mono text-emerald-700">
                              {o.result.status} · penalty {o.result.objective ?? "—"}
                            </span>
                          </div>
                          <div className="text-muted-foreground mt-0.5 pl-5">{o.tradeoff}</div>
                        </div>
                      ))}
                    </div>
                  </Section>
                )}
                {intakePlacements.length > 0 && (
                  <>
                    <TimetableGrid
                      placements={intakePlacements}
                      changed={buildPlacements.length ? changedSections(buildPlacements, intakePlacements) : undefined}
                      compact
                    />
                    <PlacementsTable placements={intakePlacements} dense />
                  </>
                )}
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
            {buildPlacements.length > 0 && <TimetableGrid placements={buildPlacements} />}
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
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Button
                  variant={recording ? "destructive" : "outline"}
                  size="sm"
                  onClick={recording ? stopVoice : startVoice}
                  disabled={voiceBusy || emergencyBusy}
                  className="flex items-center gap-1.5"
                >
                  {recording ? <Square className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                  {recording ? "Stop & transcribe" : "Record voice note"}
                </Button>
                <label className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-input bg-background hover:bg-accent cursor-pointer">
                  <Upload className="w-3.5 h-3.5" /> or upload WAV
                  <input type="file" accept=".wav,audio/wav" className="hidden" onChange={onVoiceFile} disabled={voiceBusy || emergencyBusy} />
                </label>
                {voiceBusy && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Muse Voice Transcribe…
                  </span>
                )}
              </div>
              <Button variant="primary" size="md" onClick={handleEmergency} disabled={emergencyBusy || voiceBusy} className="mt-3 flex items-center gap-2">
                {emergencyBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wrench className="w-4 h-4" />}
                Handle Emergency
              </Button>
            </Section>

            {emergency && (
              <>
                <div className="text-xs text-muted-foreground">
                  {emergency.removed_instructor_name ? `${emergency.removed_instructor_name} removed` : "No instructor identified"} — {emergency.affected_section_ids.length} section(s) affected
                  {emergency.parser_mode === "muse-spark"
                    ? ` · live Muse Spark${emergency.model ? ` (${emergency.model})` : ""}${emergency.parser_latency_ms != null ? ` · ${Math.round(emergency.parser_latency_ms / 100) / 10}s` : ""}`
                    : " · mock parser"}
                </div>
                {emergency.transcript && (
                  <div className="text-xs bg-sky-50 border border-sky-200 text-sky-900 rounded p-2">
                    <strong>Muse Voice Transcribe heard:</strong> “{emergency.transcript}”
                  </div>
                )}
                {emergency.proposals.map((p, i) => (
                  <div key={i} className={cn("flex items-center gap-2 text-xs border rounded p-2", p.feasible ? "bg-white border-emerald-200" : "bg-muted/40 border-border")}>
                    {p.feasible ? <CircleCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> : <CircleX className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
                    <span className="font-semibold">{p.course_code}</span>
                    <span>→ {p.instructor_name}</span>
                    <span className="text-muted-foreground flex-1">{p.reason}</span>
                  </div>
                ))}
                {emergencyPlacements.length > 0 && (
                  <div className="space-y-3">
                    <div className="grid gap-3 2xl:grid-cols-2">
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-muted-foreground mb-1">Before</div>
                        <TimetableGrid placements={emergencyBaseline} compact />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-amber-700 mb-1">After — verified coverage</div>
                        <TimetableGrid placements={emergencyPlacements} changed={emergencyChanged} compact />
                      </div>
                    </div>
                    <PlacementsTable placements={emergencyPlacements} dense />
                  </div>
                )}
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
          <Button variant="primary" size="md" onClick={handleNext} disabled={ingestBusy} className="flex items-center gap-1.5">
            {ingestBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
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