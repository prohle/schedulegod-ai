"use client";

// Faithful port of local-design.html VIEW 3: Course Prerequisite DAG &
// Graduation Timeline. SVG-based DAG (vis-network replaced for SSR safety),
// cohort path highlighting, term traversal simulator, prereq depth analysis.

import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, GraduationCap, Clock, CheckCircle2, AlertTriangle, Target } from "lucide-react";
import { cn } from "@/lib/utils";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useSchedule } from "@/lib/schedule-store";

interface GraphViewProps {
  onToast: (message: string, type?: "info" | "success" | "warning" | "error") => void;
}

export function GraphView({ onToast }: GraphViewProps) {
  void onToast;
  const { courses, students, activeStudentId, setActiveStudentId, getCoursePrereqDepth } = useSchedule();
  const [currentTerm, setCurrentTerm] = useState(1);
  const [highlightId, setHighlightId] = useState<string | null>(null);

  const student = students.find(s => s.id === activeStudentId) || students[0];

  // Layout: level = prereq depth (mirrors design's vis-network hierarchical LR layout)
  const levels = useMemo(() => {
    const map = new Map<string, number>();
    courses.forEach(c => map.set(c.id, getCoursePrereqDepth(c.id)));
    return map;
  }, [courses, getCoursePrereqDepth]);

  const maxLevel = Math.max(...Array.from(levels.values()), 1);
  const W = 220, H = 90, GAP_X = 70, GAP_Y = 24;

  const positions = useMemo(() => {
    const pos: Record<string, { x: number; y: number; col: number }> = {};
    const colCount = new Map<number, number>();
    courses.forEach(c => {
      const level = levels.get(c.id) || 1;
      const idx = colCount.get(level) || 0;
      colCount.set(level, idx + 1);
      pos[c.id] = {
        x: 30 + (level - 1) * (W + GAP_X),
        y: 30 + idx * (H + GAP_Y),
        col: level,
      };
    });
    return pos;
  }, [courses, levels]);

  const width = (maxLevel) * (W + GAP_X) + 60;
  const height = Math.max(...Array.from(new Set(Object.values(positions).map(p => p.y))), H) + H + 40;

  return (
    <div className="view-panel h-full w-full flex flex-col min-h-0 bg-card border border-border rounded-lg shadow-sm">
      <div className="bg-muted/50 border-b border-border rounded-t-lg p-2.5 shrink-0 flex items-center justify-between text-xs flex-wrap gap-2">
        <div>
          <h2 className="font-bold text-sm text-foreground">Course Prerequisites & DAG Graduation Timeline</h2>
          <p className="text-[11px] text-muted-foreground">Directed Acyclic Graph (DAG) for prerequisite dependencies and term path traversals.</p>
        </div>
        <div className="flex items-center space-x-2">
          <span className="font-medium text-muted-foreground">Highlight Student Path:</span>
          <Select value={activeStudentId} onChange={e => setActiveStudentId(e.target.value)} className="bg-primary/10 text-primary font-bold border-primary/50">
            {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
        </div>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row min-h-0 divide-y lg:divide-y-0 lg:divide-x divide-border">
        {/* DAG canvas */}
        <div className="flex-1 min-h-[350px] bg-muted/30 relative overflow-auto custom-scrollbar">
          <svg width={width} height={height} className="p-2">
            <defs>
              <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                <polygon points="0 0, 10 3.5, 0 7" fill="#94a3b8" />
              </marker>
            </defs>

            {/* Edges */}
            {courses.flatMap(c =>
              c.prereqs.map(prereqId => {
                const from = positions[prereqId];
                const to = positions[c.id];
                if (!from || !to) return null;
                const x1 = from.x + W, y1 = from.y + H / 2;
                const x2 = to.x, y2 = to.y + H / 2;
                const highlight = highlightId === prereqId || highlightId === c.id;
                return (
                  <path
                    key={`${prereqId}->${c.id}`}
                    d={`M ${x1} ${y1} C ${x1 + GAP_X / 2} ${y1}, ${x2 - GAP_X / 2} ${y2}, ${x2} ${y2}`}
                    stroke={highlight ? "#0284c7" : "#94a3b8"}
                    strokeWidth={highlight ? 2.5 : 2}
                    fill="none"
                    markerEnd="url(#arrowhead)"
                  />
                );
              })
            )}

            {/* Nodes */}
            {courses.map(c => {
              const pos = positions[c.id];
              if (!pos) return null;
              const isCompleted = student.completed.includes(c.id);
              const isRequired = student.requiredRemaining.includes(c.id);
              let borderColor = "#0284c7";
              if (isCompleted) borderColor = "#10b981";
              else if (isRequired) borderColor = "#f59e0b";
              const depth = levels.get(c.id) || 1;
              const termLabel = currentTerm >= depth ? "This Term" : `Term ${depth}`;

              return (
                <g
                  key={c.id}
                  transform={`translate(${pos.x}, ${pos.y})`}
                  onMouseEnter={() => setHighlightId(c.id)}
                  onMouseLeave={() => setHighlightId(null)}
                  className="cursor-pointer"
                >
                  <rect
                    width={W} height={H} rx="8"
                    fill="var(--card)"
                    stroke={borderColor}
                    strokeWidth={isRequired || isCompleted ? 3 : 1}
                    filter="drop-shadow(0 2px 4px rgba(0,0,0,0.08))"
                  />
                  <text x={W / 2} y={26} textAnchor="middle" fontSize="12" fontWeight="800" fill="var(--foreground)" fontFamily="Inter, sans-serif">
                    {c.id}
                  </text>
                  <text x={W / 2} y={48} textAnchor="middle" fontSize="10" fill="var(--muted-foreground)" fontFamily="Inter, sans-serif">
                    {c.name}
                  </text>
                  <text x={W / 2} y={70} textAnchor="middle" fontSize="9" fill={borderColor} fontFamily="Inter, sans-serif" fontWeight="700">
                    {isCompleted ? "✓ Completed" : isRequired ? `Required — ${termLabel}` : termLabel}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Side panel: Graduation timeline */}
        <div className="w-full lg:w-96 bg-card p-3 flex flex-col overflow-y-auto custom-scrollbar shrink-0">
          <h3 className="font-bold text-xs text-foreground mb-2 flex items-center gap-1.5">
            <GraduationCap className="w-4 h-4 text-emerald-600" />
            Graduation Timeline & Traversal Simulator
          </h3>

          {/* Traversal player */}
          <div className="bg-muted/50 border border-border rounded-lg p-2 mb-3">
            <div className="flex items-center justify-between text-[11px] font-bold text-foreground mb-1.5">
              <span>Term Traversal Simulator:</span>
              <span className="text-primary">
                Term {currentTerm} ({currentTerm === 1 ? "Intro" : currentTerm === 2 ? "Intermediate" : "Capstone"})
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <Button variant="outline" size="sm" onClick={() => setCurrentTerm(t => Math.max(1, t - 1))} disabled={currentTerm <= 1} className="px-2 py-1 font-bold">
                ◀ Prev
              </Button>
              <div className="flex-1 bg-muted h-2 rounded-full overflow-hidden">
                <div className="bg-primary h-full transition-all duration-300" style={{ width: `${(currentTerm / 3) * 100}%` }} />
              </div>
              <Button variant="primary" size="sm" onClick={() => setCurrentTerm(t => Math.min(3, t + 1))} disabled={currentTerm >= 3} className="px-2 py-1 font-bold">
                Next ▶
              </Button>
            </div>
          </div>

          {/* Per-student graduation estimates (from design) */}
          <div className="space-y-2 text-xs">
            {students.map(s => {
              let maxDepth = 1;
              s.requiredRemaining.forEach(cId => {
                const depth = getCoursePrereqDepth(cId);
                if (depth > maxDepth) maxDepth = depth;
              });
              const yearsToGrad = (maxDepth / 2).toFixed(1);
              return (
                <div key={s.id} className="bg-muted/50 border border-border rounded-lg p-3 shadow-sm space-y-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-extrabold text-foreground text-xs">{s.name}</h4>
                      <span className="text-[10px] text-primary font-semibold block">{s.degree}</span>
                    </div>
                    <Badge variant="success" className="text-[10px]">
                      {maxDepth} Terms ({yearsToGrad} Yrs)
                    </Badge>
                  </div>
                  <div className="text-[10px] text-muted-foreground space-y-1">
                    <div>Prerequisite DAG Critical Path: <strong className="text-foreground">{maxDepth} Terms Deep</strong></div>
                    <div>Remaining: <strong className="text-foreground">{s.requiredRemaining.join(", ")}</strong></div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Current-term courses (traversal simulation) */}
          <div className="mt-3">
            <h4 className="font-bold text-[11px] text-foreground mb-2 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-primary" />
              Term {currentTerm} Focus Courses
            </h4>
            <div className="space-y-1">
              {courses.filter(c => (levels.get(c.id) || 1) === currentTerm).map(c => {
                const isDone = student.completed.includes(c.id);
                return (
                  <div key={c.id} className={cn(
                    "flex items-center justify-between bg-card border rounded p-2 text-[11px]",
                    isDone ? "border-emerald-300 dark:border-emerald-700" : "border-border"
                  )}>
                    <span className="font-bold text-foreground">{c.id} — {c.name}</span>
                    {isDone
                      ? <Badge variant="success" className="text-[9px]"><CheckCircle2 className="w-3 h-3 mr-1" />Done</Badge>
                      : <Badge variant="info" className="text-[9px]"><Target className="w-3 h-3 mr-1" />Focus</Badge>}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
            <div className="flex items-start space-x-2 text-xs">
              <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <div className="font-bold text-amber-800 dark:text-amber-200">Degree Delay Risk</div>
                <div className="text-amber-700 dark:text-amber-300 mt-1">
                  If a mandatory section conflicts or is unplaced, the downstream DAG freezes: graduation slips one term per unmet course.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}