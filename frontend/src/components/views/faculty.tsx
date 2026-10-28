"use client";

// Faithful port of local-design.html VIEW 2: Faculty Availability & Traversal.
import { useState, useEffect } from "react";
import { Navigation, Lock, Star, AlertTriangle, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { useSchedule, DAYS, TOTAL_SLOTS, slotToTimeStr } from "@/lib/schedule-store";

interface FacultyViewProps {
  onToast: (message: string, type?: "info" | "success" | "warning" | "error") => void;
}

const TOOLS = [
  { id: "hard-block", label: "Cannot Teach", icon: <span className="w-2 h-2 rounded-full bg-red-500" /> },
  { id: "hard-req", label: "Must Teach", icon: <Lock className="w-3 h-3 text-emerald-600" /> },
  { id: "soft-pref-hi", label: "Preferred", icon: <Star className="w-3 h-3 text-green-600" /> },
  { id: "soft-avoid", label: "Prefer Not", icon: <AlertTriangle className="w-3 h-3 text-amber-600" /> },
  { id: "eraser", label: "Eraser", icon: <Minus className="w-3 h-3 text-slate-500" /> },
];

export function FacultyView({ onToast }: FacultyViewProps) {
  const {
    professors, activeProfId, facultyViewMode, activeFacTool,
    setActiveProfId, setFacultyViewMode, setActiveFacTool,
    paintFacCell, getProfTraversalStats,
  } = useSchedule();

  const [isMouseDown, setIsMouseDown] = useState(false);
  const stats = getProfTraversalStats(activeProfId);
  const prof = professors.find(p => p.id === activeProfId) || professors[0];

  useEffect(() => {
    const handleUp = () => setIsMouseDown(false);
    window.addEventListener("mouseup", handleUp);
    window.addEventListener("mouseleave", handleUp);
    return () => {
      window.removeEventListener("mouseup", handleUp);
      window.removeEventListener("mouseleave", handleUp);
    };
  }, []);

  const paint = (slotKey: string) => {
    if (!isMouseDown) return;
    paintFacCell(activeProfId, slotKey, activeFacTool);
  };

  const activeToolMeta = TOOLS.find(t => t.id === activeFacTool);

  return (
    <div className="view-panel h-full w-full flex flex-col min-h-0 bg-card border border-border rounded-lg shadow-sm">
      <div className="bg-muted/50 border-b border-border rounded-t-lg px-3 py-1.5 flex items-center justify-between text-xs shrink-0 flex-wrap gap-2">
        <div className="flex items-center space-x-3 flex-wrap gap-2">
          <div className="flex items-center bg-muted border border-border rounded-lg p-0.5">
            <Button variant={facultyViewMode === "individual" ? "primary" : "ghost"} size="sm" onClick={() => setFacultyViewMode("individual")} className="px-2.5 py-1">Individual Professor</Button>
            <Button variant={facultyViewMode === "aggregated" ? "primary" : "ghost"} size="sm" onClick={() => setFacultyViewMode("aggregated")} className="px-2.5 py-1">Aggregated Heatmap</Button>
          </div>
          {facultyViewMode === "individual" && (
            <div className="flex items-center space-x-1">
              <span className="text-muted-foreground font-medium text-[11px]">Professor:</span>
              <Select value={activeProfId} onChange={e => setActiveProfId(e.target.value)} className="bg-primary/10 text-primary font-bold border-primary/50 min-w-[220px]">
                {professors.map(p => <option key={p.id} value={p.id}>{p.name} ({p.dept})</option>)}
              </Select>
            </div>
          )}
        </div>
        {facultyViewMode === "individual" && (
          <div className="flex items-center space-x-1.5 flex-wrap gap-1">
            <span className="text-muted-foreground font-bold uppercase text-[10px] mr-1">Constraint Tool:</span>
            {TOOLS.map(tool => (
              <Button key={tool.id} variant="ghost" size="sm" onClick={() => setActiveFacTool(tool.id)}
                className={cn("flex items-center space-x-1 px-2 py-0.5 text-[11px]",
                  activeFacTool === tool.id ? "border-primary ring-2 ring-primary/40 font-semibold bg-primary/10 text-primary"
                  : tool.id === "hard-block" ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300"
                  : tool.id === "hard-req" ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300"
                  : tool.id === "soft-pref-hi" ? "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300"
                  : tool.id === "soft-avoid" ? "bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300"
                  : "bg-secondary text-secondary-foreground")}>
                {tool.icon}
                <span>{tool.label}</span>
              </Button>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 flex flex-col lg:flex-row min-h-0 divide-y lg:divide-y-0 lg:divide-x divide-border">
        <div className="flex-1 overflow-hidden bg-background flex flex-col min-h-0">
          {facultyViewMode === "individual" ? <IndividualGrid prof={prof} paint={paint} setIsMouseDown={setIsMouseDown} isMouseDown={isMouseDown} activeTool={activeToolMeta} /> : <AggregatedHeatmap />}
        </div>

        <div className="w-full lg:w-80 bg-muted/30 p-3 flex flex-col overflow-y-auto custom-scrollbar shrink-0">
          <h3 className="font-extrabold text-xs text-foreground mb-2 flex items-center gap-1.5">
            <Navigation className="w-4 h-4 text-primary" />
            Campus Traversal & Walking Distance
          </h3>
          <p className="text-[11px] text-muted-foreground mb-3">Calculates daily walking distance between back-to-back classes and flags tight transition windows.</p>

          <div className="bg-card border border-border rounded-lg p-3 shadow-sm">
            <div className="text-[11px] text-muted-foreground">Selected Professor:</div>
            <div className="font-extrabold text-sm text-primary">{prof?.name}</div>
            <div className="grid grid-cols-2 gap-2 mt-3">
              <div className="p-2 bg-muted border border-border rounded text-center">
                <span className="text-[10px] text-muted-foreground block">Weekly Walk</span>
                <span className="font-bold text-xs text-foreground">{stats.totalMeters} m</span>
              </div>
              <div className="p-2 bg-muted border border-border rounded text-center">
                <span className="text-[10px] text-muted-foreground block">Back-to-Back</span>
                <span className={cn("font-bold text-xs", stats.tightTransitions > 0 ? "text-amber-600" : "text-primary")}>
                  {stats.totalTransitions} ({stats.tightTransitions} Tight)
                </span>
              </div>
            </div>
          </div>

          <div className="text-[11px] font-bold text-foreground mt-3 mb-1">Classroom Transition Paths:</div>
          {DAYS.filter(day => stats.dailyBreakdown[day]?.length > 0).length === 0 ? (
            <div className="text-[11px] text-muted-foreground italic bg-card p-3 border border-border rounded text-center">
              No back-to-back room transitions scheduled for this professor.
            </div>
          ) : (
            <div className="space-y-2">
              {DAYS.map(day => {
                const transfers = stats.dailyBreakdown[day];
                if (!transfers || transfers.length === 0) return null;
                return (
                  <div key={day} className="bg-card border border-border rounded p-2 text-xs space-y-1">
                    <span className="font-bold text-foreground block text-[11px]">{day}:</span>
                    {transfers.map((t, idx) => (
                      <div key={idx} className="flex items-center justify-between text-[10px] text-muted-foreground bg-muted p-1 rounded">
                        <span>{t.time}: <strong>{t.from}</strong> ➔ <strong>{t.to}</strong></span>
                        <span className={cn("font-semibold", t.walkMins > 3 ? "text-amber-600 font-bold" : "text-primary")}>
                          +{t.dist}m ({t.walkMins}m walk)
                        </span>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function IndividualGrid({
  prof, paint, setIsMouseDown, isMouseDown, activeTool,
}: {
  prof: { id: string; name: string; gridState: Record<string, string> } | undefined;
  paint: (slotKey: string) => void;
  setIsMouseDown: (down: boolean) => void;
  isMouseDown: boolean;
  activeTool: { id: string; label: string } | undefined;
}) {
  void isMouseDown;
  if (!prof) return null;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="grid grid-cols-7 bg-muted border-b border-border font-bold text-[11px] text-muted-foreground shrink-0">
        <div className="p-1.5 text-center border-r border-border bg-muted/70 flex items-center justify-center">Time</div>
        {DAYS.map(day => <div key={day} className="p-1.5 text-center border-r border-border last:border-r-0 flex items-center justify-center">{day}</div>)}
      </div>

      <div className="flex-1 flex flex-col min-h-0 overflow-y-auto custom-scrollbar">
        {Array.from({ length: TOTAL_SLOTS }, (_, slot) => {
          const timeStr = slotToTimeStr(slot);
          const isHour = slot % 2 === 0;
          return (
            <div key={slot} className="flex-1 min-h-[24px] grid grid-cols-7">
              <div className={cn("text-[9px] font-mono text-muted-foreground bg-muted/50 border-r border-border flex items-center justify-center text-center px-0.5 leading-none", isHour && "border-t-2 border-t-border")}>
                {timeStr}
              </div>
              {DAYS.map((_, day) => {
                const slotKey = `${day}-${slot}`;
                const cellState = prof.gridState[slotKey];
                let bg = "hover:bg-accent/50";
                let label = "";
                if (cellState === "hard-block") { bg = "hatch-pattern text-white"; label = "✕"; }
                else if (cellState === "hard-req") { bg = "bg-emerald-600 text-white font-bold"; label = "🔒"; }
                else if (cellState === "soft-pref-hi") { bg = "bg-green-500 text-white"; label = "★"; }
                else if (cellState === "soft-avoid") { bg = "bg-amber-500 text-white"; label = "⚠️"; }
                return (
                  <div key={slotKey}
                    onMouseDown={e => { e.preventDefault(); setIsMouseDown(true); paint(slotKey); }}
                    onMouseEnter={() => { if (isMouseDown) paint(slotKey); }}
                    className={cn("border-r border-border/50 last:border-r-0 cursor-pointer transition flex items-center justify-center text-[10px] no-select", bg)}
                    title={activeTool ? `Paint: ${activeTool.label}` : undefined}>
                    {label}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AggregatedHeatmap() {
  const { professors } = useSchedule();
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="grid grid-cols-7 bg-muted border-b border-border font-bold text-[11px] text-muted-foreground shrink-0">
        <div className="p-1.5 text-center border-r border-border bg-muted/70 flex items-center justify-center">Time</div>
        {DAYS.map(day => <div key={day} className="p-1.5 text-center border-r border-border last:border-r-0 flex items-center justify-center">{day}</div>)}
      </div>
      <div className="flex-1 flex flex-col min-h-0 overflow-y-auto custom-scrollbar">
        {Array.from({ length: TOTAL_SLOTS }, (_, slot) => (
          <div key={slot} className="flex-1 min-h-[24px] grid grid-cols-7">
            <div className="text-[9px] font-mono text-muted-foreground bg-muted/50 border-r border-border flex items-center justify-center text-center px-0.5 leading-none">
              {slotToTimeStr(slot)}
            </div>
            {DAYS.map((_, day) => {
              const slotKey = `${day}-${slot}`;
              let availCount = 0;
              professors.forEach(p => { if (p.gridState[slotKey] !== "hard-block") availCount++; });
              const ratio = availCount / professors.length;
              let bg = "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-200";
              if (availCount === 0) bg = "hatch-pattern text-red-800";
              else if (ratio < 0.5) bg = "bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200";
              return (
                <div key={slotKey} className={cn("border-r border-border/50 last:border-r-0 flex items-center justify-center text-[9px] font-bold", bg)}>
                  {availCount}/{professors.length}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}