"use client";

import { useState, useMemo, useCallback } from "react";
import { Navigation, User, Building, AlertTriangle, ChevronLeft, ChevronRight, MapPin, Footprints, Clock, Lock, Star, AlertCircle, Minus, Users, BarChart2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import type { Scenario, Instructor, Placement, Room } from "@/types";

interface FacultyViewProps {
  scenario: Scenario;
  onCopilotMessage: (message: string) => Promise<void>;
}

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DAY_NAMES_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const PERIOD_NAMES = ["8:00", "10:00", "13:00", "15:00"];

export function FacultyView({ scenario, onCopilotMessage }: FacultyViewProps) {
  const [viewMode, setViewMode] = useState<"individual" | "aggregated">("individual");
  const [selectedProfId, setSelectedProfId] = useState(scenario.instructors[0]?.id || "");
  const [activeTool, setActiveTool] = useState<"hard-block" | "hard-req" | "soft-pref-hi" | "soft-avoid" | "eraser">("hard-req");

  const tools = [
    { id: "hard-block", label: "Cannot Teach", icon: <div className="w-2 h-2 rounded-full bg-red-500" />, bg: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300" },
    { id: "hard-req", label: "Must Teach", icon: <Lock className="w-3 h-3 text-emerald-600" />, bg: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border-emerald-500" },
    { id: "soft-pref-hi", label: "Preferred", icon: <Star className="w-3 h-3 text-green-600" />, bg: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300" },
    { id: "soft-avoid", label: "Prefer Not", icon: <AlertTriangle className="w-3 h-3 text-amber-600" />, bg: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300" },
    { id: "eraser", label: "Eraser", icon: <Minus className="w-3 h-3 text-slate-500" />, bg: "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300" },
  ];

  const selectedProf = scenario.instructors.find(p => p.id === selectedProfId) || scenario.instructors[0];

  // Calculate traversal stats for selected professor
  const traversalStats = useMemo(() => {
    if (!selectedProf) return null;
    // In a real implementation, this would come from actual placements
    return {
      totalMeters: 0,
      totalTransitions: 0,
      tightTransitions: 0,
      dailyBreakdown: {} as Record<string, any[]>,
    };
  }, [selectedProf]);

  return (
    <div className="view-panel h-full w-full flex flex-col min-h-0 bg-card border border-border rounded-lg shadow-sm">
      {/* Header Controls */}
      <div className="bg-muted/50 border-b border-border rounded-t-lg px-3 py-1.5 flex items-center justify-between text-xs shrink-0 flex-wrap gap-2">
        <div className="flex items-center space-x-3">
          <div className="flex items-center bg-muted border border-border rounded-lg p-0.5">
            <Button
              variant={viewMode === "individual" ? "primary" : "ghost"}
              size="sm"
              onClick={() => setViewMode("individual")}
              className="px-2.5 py-1"
            >
              Individual Professor
            </Button>
            <Button
              variant={viewMode === "aggregated" ? "primary" : "ghost"}
              size="sm"
              onClick={() => setViewMode("aggregated")}
              className="px-2.5 py-1"
            >
              Aggregated Heatmap
            </Button>
          </div>

          {viewMode === "individual" && (
            <div className="flex items-center space-x-1">
              <span className="text-muted-foreground font-medium text-[11px]">Professor:</span>
              <Select value={selectedProfId} onChange={(e) => setSelectedProfId(e.target.value)} className="w-auto min-w-[200px] bg-primary/10 text-primary font-bold border-primary/50">
                {scenario.instructors.map(p => (
                  <option key={p.id} value={p.id}>{p.name} ({p.qualified_courses.join(", ")})</option>
                ))}
              </Select>
            </div>
          )}

          <div className="flex items-center space-x-1.5">
            <span className="text-muted-foreground font-bold uppercase text-[10px] mr-1">Tool:</span>
            {tools.map(tool => (
              <Button
                key={tool.id}
                variant={activeTool === tool.id ? "primary" : "ghost"}
                size="sm"
                onClick={() => setActiveTool(tool.id as "hard-block" | "hard-req" | "soft-pref-hi" | "soft-avoid" | "eraser")}
                className={cn("flex items-center space-x-1 px-2 py-0.5", tool.id === "hard-block" && "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300")}
              >
                {tool.icon}
                <span>{tool.label}</span>
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Grid + Side Panel */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0 divide-y lg:divide-y-0 lg:divide-x divide-border">
        {/* Grid Container */}
        <div className="flex-1 overflow-hidden bg-background flex flex-col min-h-0">
          {viewMode === "individual" ? (
            <IndividualProfessorGrid
              scenario={scenario}
              selectedProf={selectedProf}
              activeTool={activeTool}
              onCopilotMessage={onCopilotMessage}
            />
          ) : (
            <AggregatedHeatmapGrid scenario={scenario} />
          )}
        </div>

        {/* Side Panel: Professor Traversal & Walking Distance */}
        <div className="w-full lg:w-80 bg-muted/30 p-3 flex flex-col overflow-y-auto custom-scrollbar shrink-0 lg:border-l lg:border-border">
          <h3 className="font-extrabold text-xs text-foreground mb-2 flex items-center gap-1.5">
            <Navigation className="w-4 h-4 text-primary" />
            Campus Traversal & Walking Distance
          </h3>
          <p className="text-[11px] text-muted-foreground mb-3">Calculates daily walking distance between back-to-back classes and flags tight transition windows.</p>
          
          <TraversalStatsPanel stats={traversalStats} prof={selectedProf} />
        </div>
      </div>
    </div>
  );
}

function IndividualProfessorGrid({
  scenario,
  selectedProf,
  activeTool,
  onCopilotMessage,
}: {
  scenario: Scenario;
  selectedProf: Instructor;
  activeTool: string;
  onCopilotMessage: (message: string) => Promise<void>;
}) {
  const prof = selectedProf || scenario.instructors[0];

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      {/* Header Row */}
      <div className="grid grid-cols-7 bg-muted/50 border-b border-border font-bold text-[11px] text-muted-foreground shrink-0">
        <div className="p-1.5 text-center border-r border-border bg-muted/50 flex items-center justify-center">Time</div>
        {DAY_NAMES.map(day => (
          <div key={day} className="p-1.5 text-center border-r border-border last:border-r-0 flex items-center justify-center">{day}</div>
        ))}
      </div>

      {/* Grid Rows */}
      <div className="flex-1 flex flex-col min-h-0 overflow-y-auto custom-scrollbar">
        {PERIOD_NAMES.map((periodName, slot) => (
          <div key={slot} className="flex-1 min-h-[60px] grid grid-cols-7 border-t border-border/60">
            <div className="text-[9px] font-mono text-muted-foreground bg-muted/50 border-r border-border flex items-center justify-center text-center px-0.5 leading-none">
              {periodName}
            </div>
            {DAY_NAMES.map((_, day) => {
              const slotKey = `${day}-${slot}`;
              const cellState = prof.gridState?.[slotKey];
              let bg = "hover:bg-accent/50";
              let label = "";

              if (cellState === "hard-block") { bg = "bg-red-500/20 text-red-700 dark:text-red-300"; label = "✕"; }
              else if (cellState === "hard-req") { bg = "bg-emerald-600 text-white font-bold"; label = "🔒"; }
              else if (cellState === "soft-pref-hi") { bg = "bg-green-500 text-white"; label = "★"; }
              else if (cellState === "soft-avoid") { bg = "bg-amber-500 text-white"; label = "⚠️"; }

              return (
                <div
                  key={`${day}-${slot}`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    const newGridState = { ...prof.gridState };
                    if (activeTool === "eraser") delete newGridState[slotKey];
                    else newGridState[slotKey] = activeTool;
                    onCopilotMessage(`Set ${prof.name} ${DAY_NAMES[day]} ${PERIOD_NAMES[slot]} to ${activeTool}`);
                  }}
                  onMouseEnter={(e) => {
                    if ((e as any).buttons === 1) {
                      const newGridState = { ...prof.gridState };
                      if (activeTool === "eraser") delete newGridState[slotKey];
                      else newGridState[slotKey] = activeTool;
                    }
                  }}
                  className={cn("border-r border-border/60 last:border-r-0 cursor-pointer transition flex items-center justify-center text-[10px]", bg)}
                >
                  {label}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function AggregatedHeatmapGrid({ scenario }: { scenario: Scenario }) {
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
          <div key={slot} className="flex-1 min-h-[40px] grid grid-cols-7 border-t border-border/60">
            <div className="text-[9px] font-mono text-muted-foreground bg-muted/50 border-r border-border flex items-center justify-center text-center px-0.5 leading-none">
              {periodName}
            </div>
            {DAY_NAMES.map((_, day) => {
              const slotKey = `${day}-${slot}`;
              let availCount = 0;
              scenario.instructors.forEach(p => {
                if (p.gridState?.[slotKey] !== "hard-block") availCount++;
              });
              const ratio = availCount / scenario.instructors.length;
              let bg = "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-200";
              if (availCount === 0) bg = "bg-red-500/20 text-red-700 dark:text-red-300";
              else if (ratio < 0.5) bg = "bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200";

              return (
                <div key={`${day}-${slot}`} className={cn("border-r border-border/60 last:border-r-0 flex items-center justify-center text-[9px] font-bold", bg)}>
                  {availCount}/{scenario.instructors.length}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function TraversalStatsPanel({ stats, prof }: { stats: any; prof: Instructor | undefined }) {
  if (!prof || !stats) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Navigation className="w-12 h-12 mx-auto mb-3 text-muted-foreground/50" />
        <p className="text-sm">Select a professor to see traversal analysis.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="bg-card border border-border rounded-lg p-3 shadow-xs">
        <div className="text-[11px] text-muted-foreground">Selected Professor:</div>
        <div className="font-extrabold text-sm text-primary">{prof.name}</div>
        
        <div className="grid grid-cols-2 gap-2 mt-3">
          <div className="p-2 bg-muted border border-border rounded text-center">
            <span className="text-[10px] text-muted-foreground block">Weekly Walk</span>
            <span className="font-bold text-xs text-foreground">{stats.totalMeters} m</span>
          </div>
          <div className="p-2 bg-muted border border-border rounded text-center">
            <span className="text-[10px] text-muted-foreground block">Back-to-Back</span>
            <span className="font-bold text-xs text-amber-600">{stats.totalTransitions} ({stats.tightTransitions} Tight)</span>
          </div>
        </div>
      </div>

      <div className="text-[11px] font-bold text-foreground mb-1">Classroom Transition Paths:</div>
      {Object.keys(stats.dailyBreakdown).length === 0 ? (
        <div className="text-[11px] text-muted-foreground italic bg-card p-3 border border-border rounded text-center">
          No back-to-back room transitions scheduled for this professor.
        </div>
      ) : (
        <div className="space-y-2">
          {Object.entries(stats.dailyBreakdown).map(([day, transitions]) => (
            <div key={day} className="bg-card border border-border rounded p-2 text-xs space-y-1">
              <span className="font-bold text-foreground block text-[11px]">{day}:</span>
              {(transitions as any[]).map((t, idx) => (
                <div key={idx} className="flex items-center justify-between text-[10px] text-muted-foreground bg-muted p-1 rounded">
                  <span>{t.time}: <strong>{t.from}</strong> ➔ <strong>{t.to}</strong></span>
                  <span className="font-semibold text-amber-600">+{t.dist}m ({t.walkMins}m walk)</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}