"use client";

// VIEW: Intelligence — the live backend bridge. Spectral radar over the
// section-conflict graph, the C39 four-course guarantee audit, real CP-SAT
// solve, and Muse-proposed / CP-SAT-verified tightening moves. Every number
// here comes from the Python backend, not the in-browser toy solver.

import { Fragment, useState, type ReactNode } from "react";
import {
  Radar, ShieldCheck, Sparkles, GitFork, Activity, Wrench,
  CircleCheck, CircleX, Loader2, Database, Network, RefreshCw, Gauge,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useIntelligence } from "@/hooks/use-api";
import {
  DAY_NAMES, PERIOD_NAMES, PATTERN_DAYS,
  type Placement, type SparseMatrixPayload,
} from "@/types";

interface IntelligenceViewProps {
  onToast: (message: string, type?: "info" | "success" | "warning" | "error") => void;
}

function Card({ title, icon, children, className }: {
  title: string;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("bg-card border border-border rounded-lg shadow-sm", className)}>
      <header className="px-4 py-2.5 border-b border-border flex items-center gap-2">
        {icon}
        <h3 className="font-bold text-sm text-foreground">{title}</h3>
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="bg-muted/40 border border-border rounded-lg p-3">
      <div className="text-2xl font-extrabold text-foreground">{value}</div>
      <div className="text-[11px] text-muted-foreground mt-0.5">{label}</div>
      {hint && <div className="text-[10px] text-muted-foreground/70 mt-1">{hint}</div>}
    </div>
  );
}

function placementSlot(p: Placement): string {
  if (p.period != null) {
    const pattern = PATTERN_DAYS.MWF.includes(p.days[0]) && p.days.length === 3 ? "MWF" : "TTh";
    return `${pattern} @${PERIOD_NAMES[p.period]}`;
  }
  const day = DAY_NAMES[p.days[0]]?.slice(0, 3) ?? "?";
  return `${day} @${PERIOD_NAMES[p.periods[0]]}-${PERIOD_NAMES[p.periods[1] ?? p.periods[0]]}`;
}

const MATRIX_ROWS: [string, keyof ReturnType<typeof Object>][] = [];

export function IntelligenceView({ onToast }: IntelligenceViewProps) {
  const { matrices, spectral, margins, utilization, solveResult, tighten, loading, busy, error, runSolve, runTighten, reload } = useIntelligence();
  const [tab, setTab] = useState<"radar" | "margins" | "matrices" | "utilization" | "solve" | "tighten">("radar");

  if (error) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 p-8 text-center">
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-full">
          <Wrench className="w-8 h-8 text-amber-600" />
        </div>
        <div>
          <h2 className="font-extrabold text-lg text-foreground">Backend not reachable</h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-md">{error}</p>
        </div>
        <Button variant="outline" size="md" onClick={reload} className="flex items-center gap-2">
          <RefreshCw className="w-4 h-4" /> Retry
        </Button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading intelligence layer…
      </div>
    );
  }

  const tabs = [
    { id: "radar" as const, label: "Spectral Radar", icon: <Radar className="w-3.5 h-3.5" /> },
    { id: "margins" as const, label: "4-Course Guarantee", icon: <ShieldCheck className="w-3.5 h-3.5" /> },
    { id: "utilization" as const, label: "Utilization", icon: <Gauge className="w-3.5 h-3.5" /> },
    { id: "matrices" as const, label: "Sparse Matrices", icon: <Database className="w-3.5 h-3.5" /> },
    { id: "solve" as const, label: "CP-SAT Solve", icon: <Sparkles className="w-3.5 h-3.5" /> },
    { id: "tighten" as const, label: "AI Tightening", icon: <Wrench className="w-3.5 h-3.5" /> },
  ];

  const matrixRows: [string, SparseMatrixPayload][] = matrices ? [
    ["Classroom (rooms × courses)", matrices.classroom],
    ["Degree fulfilment (cohorts × courses)", matrices.fulfilment],
    ["Cohort demand (cohorts × courses)", matrices.demand],
    ["Cohort sections (cohorts × sections)", matrices.cohort_sections],
    ["Faculty availability (instructors × slots)", matrices.faculty_availability],
    ["Faculty blackouts", matrices.faculty_blackouts],
    ["Faculty preferences", matrices.faculty_preferences],
    ["Qualifications (instructors × courses)", matrices.qualification],
  ] : [];

  return (
    <div className="h-full w-full flex flex-col min-h-0 bg-card border border-border rounded-lg shadow-sm">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border shrink-0 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Network className="w-5 h-5 text-primary" />
          <div>
            <h2 className="font-extrabold text-foreground">Intelligence</h2>
            <p className="text-xs text-muted-foreground">Spectral radar · C39 audit · CP-SAT · verified tightening — live from the backend</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="primary" size="sm" onClick={() => { runSolve(); onToast("Running CP-SAT solve…", "info"); }} disabled={busy !== null} className="flex items-center gap-1.5">
            {busy === "solve" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            Solve
          </Button>
          <Button variant="outline" size="sm" onClick={() => { runTighten(); onToast("Muse is proposing repairs…", "info"); }} disabled={busy !== null} className="flex items-center gap-1.5">
            {busy === "tighten" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wrench className="w-3.5 h-3.5" />}
            Tighten
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-4 pt-2 shrink-0 flex items-center gap-1 border-b border-border overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "px-3 py-2 text-xs font-semibold rounded-t-lg border border-b-0 flex items-center gap-1.5 transition-colors",
              tab === t.id ? "bg-background text-primary border-border" : "text-muted-foreground hover:bg-muted border-transparent"
            )}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-4 custom-scrollbar">
        {tab === "radar" && spectral && (
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="grid grid-cols-2 gap-3 lg:col-span-3">
              <Stat label="Algebraic connectivity μ₂" value={spectral.algebraic_connectivity.toFixed(3)} hint={spectral.algebraic_connectivity === 0 ? "disconnected → independent islands" : "tightly-coupled core"} />
              <Stat label="Hoffman chromatic lower bound" value={`χ ≥ ${spectral.hoffman_chromatic_lower_bound}`} hint="fewer colors needed than periods → feasible" />
              <Stat label="Max clique" value={spectral.max_clique.length} hint="sections that all pairwise conflict" />
              <Stat label="Largest Laplacian eigenvalue" value={spectral.largest_laplacian_eigenvalue.toFixed(2)} hint="rigidity of the conflict graph" />
            </div>

            <Card title="Scheduling islands" icon={<GitFork className="w-4 h-4 text-primary" />} className="lg:col-span-2">
              {spectral.components.map((comp, i) => (
                <div key={i} className="mb-2 last:mb-0">
                  <div className="text-[11px] text-muted-foreground mb-1">Island {i + 1} · {comp.length} section{comp.length > 1 ? "s" : ""}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {comp.map((s) => (
                      <span key={s} className="px-2 py-0.5 bg-muted rounded text-[11px] font-mono text-foreground">{s.replace("sec-", "")}</span>
                    ))}
                  </div>
                </div>
              ))}
            </Card>

            <Card title="Warm-start hints (AddHint)" icon={<Activity className="w-4 h-4 text-emerald-600" />}>
              {Object.entries(spectral.slot_hints).length ? (
                <div className="space-y-1">
                  {Object.entries(spectral.slot_hints).map(([sid, period]) => (
                    <div key={sid} className="flex items-center justify-between text-xs">
                      <span className="font-mono">{sid.replace("sec-", "")}</span>
                      <span className="text-emerald-700 font-semibold">period {period} (Fiedler coloring)</span>
                    </div>
                  ))}
                  <p className="text-[10px] text-muted-foreground pt-2 border-t border-border mt-2">
                    Spectral coloring → CP-SAT warm start. Hints guide search, never break feasibility.
                  </p>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No cohort-conflicting sections need a hint.</p>
              )}
            </Card>

            {spectral.deadlock_warnings.length > 0 && (
              <Card title="Deadlock warnings" icon={<CircleX className="w-4 h-4 text-amber-600" />} className="lg:col-span-3">
                <ul className="space-y-1.5">
                  {spectral.deadlock_warnings.map((w, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded p-2">
                      <CircleX className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                      {w}
                    </li>
                  ))}
                </ul>
              </Card>
            )}

            <Card title="Spectral ordering (solve order)" icon={<Activity className="w-4 h-4 text-sky-600" />} className="lg:col-span-3">
              <div className="flex flex-wrap gap-1.5">
                {spectral.spectral_order.map((s, i) => (
                  <span key={s} className="px-2 py-0.5 bg-sky-50 border border-sky-200 rounded text-[11px] font-mono text-sky-900">
                    {i + 1}. {s.replace("sec-", "")}
                  </span>
                ))}
              </div>
            </Card>
          </div>
        )}

        {tab === "margins" && margins && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <ShieldCheck className="w-4 h-4 text-primary" />
              Each cohort must assemble <strong className="text-foreground">{margins.min_courses}</strong> distinct, non-overlapping courses toward graduation.
            </div>
            <div className="space-y-2">
              {margins.cohorts.map((m) => (
                <div key={m.cohort_id} className={cn("border rounded-lg p-3", m.ok ? "bg-emerald-50/40 border-emerald-200" : "bg-amber-50/60 border-amber-200")}>
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <span className="font-bold text-foreground">{m.name}</span>
                      <span className="text-[11px] text-muted-foreground ml-2">{m.size} students · {m.terms_remaining} terms to graduation</span>
                    </div>
                    <span className={cn("text-[11px] font-bold px-2 py-0.5 rounded", m.ok ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800")}>
                      {m.margin} / {margins.min_courses} courses
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {m.example_track.map((c) => (
                      <span key={c} className="px-2 py-0.5 bg-white border border-border rounded text-[11px] font-mono text-foreground">{c}</span>
                    ))}
                    {m.example_track.length === 0 && <span className="text-[11px] text-muted-foreground">no placed courses</span>}
                  </div>
                  <p className={cn("text-[11px]", m.ok ? "text-emerald-700" : "text-amber-700")}>{m.risk}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "utilization" && utilization && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Stat label="Campus utilization (peak)" value={`${Math.round(utilization.room_utilization * 100)}%`} hint="peak seats ÷ total capacity across rooms" />
              <Stat label="Faculty within load caps" value={utilization.all_loads_met ? <span className="text-emerald-600">✓ all</span> : <span className="text-amber-600">⚠ some over</span>} hint="no instructor over max_sections" />
            </div>

            <Card title="Room utilization (peak)" icon={<Gauge className="w-4 h-4 text-primary" />}>
              <div className="space-y-2">
                {utilization.rooms.map((r) => (
                  <div key={r.room_id} className="flex items-center gap-3">
                    <span className="text-xs font-medium text-foreground w-40 truncate">{r.name}</span>
                    <div className="flex-1 h-2 bg-muted rounded overflow-hidden">
                      <div className={cn("h-full rounded", r.utilization > 0.9 ? "bg-amber-400" : "bg-emerald-500")} style={{ width: `${Math.round(r.utilization * 100)}%` }} />
                    </div>
                    <span className="text-[11px] font-mono text-muted-foreground w-24 text-right">{r.peak_seats}/{r.capacity} · {Math.round(r.utilization * 100)}%</span>
                  </div>
                ))}
              </div>
            </Card>

            <Card title="Faculty load (vs contract cap)" icon={<ShieldCheck className="w-4 h-4 text-emerald-600" />}>
              <div className="space-y-2">
                {utilization.faculty.map((f) => (
                  <div key={f.instructor_id} className="flex items-center gap-3">
                    <span className="text-xs font-medium text-foreground w-40 truncate">{f.name}</span>
                    <div className="flex-1 h-2 bg-muted rounded overflow-hidden">
                      <div className={cn("h-full rounded", f.satisfied ? "bg-emerald-500" : "bg-red-400")} style={{ width: `${Math.round(f.utilization * 100)}%` }} />
                    </div>
                    <span className="text-[11px] font-mono text-muted-foreground w-24 text-right">{f.load}/{f.max_sections} sections</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        {tab === "matrices" && matrices && (
          <div className="space-y-4">
            <div className="overflow-x-auto border border-border rounded-lg">
              <table className="w-full text-xs">
                <thead className="bg-muted text-muted-foreground">
                  <tr>
                    <th className="text-left px-3 py-2 font-semibold">Matrix</th>
                    <th className="text-left px-3 py-2 font-semibold">Shape</th>
                    <th className="text-right px-3 py-2 font-semibold">NNZ</th>
                    <th className="text-right px-3 py-2 font-semibold">Density</th>
                  </tr>
                </thead>
                <tbody>
                  {matrixRows.map(([label, m]) => (
                    <tr key={label} className="border-t border-border">
                      <td className="px-3 py-1.5 text-foreground">{label}</td>
                      <td className="px-3 py-1.5 font-mono text-muted-foreground">{m.shape[0]}×{m.shape[1]}</td>
                      <td className="px-3 py-1.5 font-mono text-right">{m.nnz}</td>
                      <td className="px-3 py-1.5 font-mono text-right">{Math.round(m.density * 100)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Card title="Departmental capacity heatmap (stack faculty tensor)" icon={<Database className="w-4 h-4 text-primary" />}>
              <div className="grid grid-cols-6 gap-1 items-center">
                <div />
                {DAY_NAMES.slice(0, 5).map((d) => (
                  <div key={d} className="text-[10px] text-muted-foreground font-semibold text-center">{d.slice(0, 3)}</div>
                ))}
                {PERIOD_NAMES.map((_, period) => (
                  <Fragment key={period}>
                    <div className="text-[10px] text-muted-foreground font-semibold">{PERIOD_NAMES[period]}</div>
                    {Array.from({ length: 5 }, (_, day) => {
                      const value = matrices.department_capacity[day]?.[period] ?? 0;
                      const dead = matrices.dead_zones.some(([dd, pp]) => dd === day && pp === period);
                      return (
                        <div key={`${day}-${period}`} className={cn(
                          "h-9 rounded flex items-center justify-center text-xs font-bold",
                          dead ? "bg-red-100 text-red-700 border border-red-200" : "bg-emerald-50 text-emerald-800 border border-emerald-100"
                        )}>
                          {dead ? "0" : value}
                        </div>
                      );
                    })}
                  </Fragment>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground mt-2">
                {matrices.dead_zones.length ? "Red = dead zone (no instructor available)." : "No dead zones — every slot has faculty supply."}
              </p>
            </Card>
          </div>
        )}

        {tab === "solve" && (
          <div className="space-y-4">
            {!solveResult ? (
              <div className="text-center py-10 text-muted-foreground text-sm">
                Run <strong className="text-foreground">CP-SAT Solve</strong> to generate the real timetable (backend OR-Tools, not the toy solver).
              </div>
            ) : solveResult.status === "infeasible" ? (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-800">
                Infeasible — the backend returns the minimal conflict core.
              </div>
            ) : (
              <>
                <div className="flex items-center gap-4 flex-wrap">
                  <Stat label="Status" value={<span className="text-emerald-600">{solveResult.status.toUpperCase()}</span>} />
                  <Stat label="Solve time" value={`${solveResult.solve_time_ms} ms`} />
                  <Stat label="Objective (preference penalty)" value={solveResult.objective ?? "—"} />
                </div>
                <Card title="Placements" icon={<Sparkles className="w-4 h-4 text-primary" />}>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-muted text-muted-foreground">
                        <tr>
                          <th className="text-left px-3 py-2 font-semibold">Course</th>
                          <th className="text-left px-3 py-2 font-semibold">Instructor</th>
                          <th className="text-left px-3 py-2 font-semibold">Room</th>
                          <th className="text-left px-3 py-2 font-semibold">Slot</th>
                          <th className="text-right px-3 py-2 font-semibold">Length</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(solveResult.timetable?.placements ?? []).map((p) => (
                          <tr key={p.section_id} className="border-t border-border">
                            <td className="px-3 py-1.5 font-semibold text-foreground">{p.course_code}</td>
                            <td className="px-3 py-1.5 text-muted-foreground">{p.instructor_name}</td>
                            <td className="px-3 py-1.5 text-muted-foreground">{p.room_name} <span className="text-[10px]">[{p.building_id}]</span></td>
                            <td className="px-3 py-1.5 font-mono text-muted-foreground">{placementSlot(p)}</td>
                            <td className="px-3 py-1.5 text-right font-mono text-muted-foreground">{p.duration ?? 1.5}h</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </>
            )}
          </div>
        )}

        {tab === "tighten" && (
          <div className="space-y-4">
            {!tighten ? (
              <div className="text-center py-10 text-muted-foreground text-sm">
                Run <strong className="text-foreground">Tighten</strong> to have Muse Spark propose repair moves and CP-SAT verify them.
              </div>
            ) : (
              <>
                <div className={cn(
                  "border rounded-lg p-3 text-sm",
                  tighten.trigger === "none" ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                    : tighten.trigger === "infeasible" ? "bg-red-50 border-red-200 text-red-800"
                    : "bg-amber-50 border-amber-200 text-amber-800"
                )}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wide",
                      tighten.muse_mode === "muse-spark" ? "bg-sky-100 text-sky-800" : "bg-muted text-muted-foreground")}>
                      {tighten.muse_mode}
                    </span>
                    <span className="text-[11px] font-bold uppercase">{tighten.trigger}</span>
                  </div>
                  <p>{tighten.assessment}</p>
                </div>

                {tighten.moves.length > 0 && (
                  <Card title={`Moves (${tighten.moves.filter((m) => m.verified).length} verified)`} icon={<Wrench className="w-4 h-4 text-primary" />}>
                    <div className="space-y-2">
                      {tighten.moves.map((mv, i) => (
                        <div key={i} className={cn("border rounded-lg p-3", mv.verified ? "border-emerald-200 bg-emerald-50/40" : "border-border bg-muted/30")}>
                          <div className="flex items-center gap-2 mb-1">
                            {mv.verified
                              ? <CircleCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                              : <CircleX className="w-4 h-4 text-muted-foreground shrink-0" />}
                            <span className="font-mono text-xs font-bold text-foreground">{mv.kind}</span>
                            <span className="text-[11px] text-muted-foreground">
                              {[mv.instructor_id, mv.course_id, mv.cohort_id].filter(Boolean).join(" → ")}
                            </span>
                          </div>
                          <p className="text-[11px] text-muted-foreground mb-1">{mv.rationale}</p>
                          <p className={cn("text-[11px] font-medium", mv.verified ? "text-emerald-700" : "text-muted-foreground")}>{mv.detail}</p>
                        </div>
                      ))}
                    </div>
                  </Card>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}