"use client";

// Vertical nav with the two interfaces: Guided (step-by-step) vs Advanced
// (Intelligence). No toy views — both routes hit the real backend.
import { Zap, Brain } from "lucide-react";
import { cn } from "@/lib/utils";

export type ActiveView = "wizard" | "intelligence";

const VIEWS = [
  {
    id: "wizard" as const,
    label: "Guided Wizard",
    icon: Zap,
    tag: "Simple",
    desc: "Step-by-step: Import → Intake → Build → Review → Emergency",
  },
  {
    id: "intelligence" as const,
    label: "Intelligence",
    icon: Brain,
    tag: "Advanced",
    desc: "Spectral radar · C39 audit · CP-SAT · verified tightening",
  },
];

interface SidebarProps {
  activeView: ActiveView;
  setActiveView: (view: ActiveView) => void;
}

export function Sidebar({ activeView, setActiveView }: SidebarProps) {
  return (
    <aside className="bg-card border-r border-border flex flex-col shrink-0 w-64">
      <div className="p-3 border-b border-border flex items-center space-x-2 shrink-0">
        <div className="p-2 bg-gradient-to-tr from-sky-500 to-indigo-600 rounded-lg text-white shadow-md">
          <Zap className="w-5 h-5" />
        </div>
        <div>
          <h2 className="font-extrabold text-sm">ScheduleGod</h2>
          <p className="text-[10px] text-muted-foreground">Proven scheduling co-pilot</p>
        </div>
      </div>

      <nav className="flex-1 p-2 space-y-1 overflow-y-auto" role="navigation" aria-label="Main navigation">
        {VIEWS.map((view) => {
          const Icon = view.icon;
          const isActive = activeView === view.id;
          return (
            <button
              key={view.id}
              onClick={() => setActiveView(view.id)}
              className={cn(
                "w-full justify-start text-xs gap-2 px-2 py-2.5 rounded-lg transition-all flex border-l-4",
                isActive
                  ? "bg-gradient-to-r from-sky-50 to-indigo-50 text-primary border border-primary/30 border-l-primary shadow-sm"
                  : "hover:bg-muted text-foreground border-transparent"
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="flex-1 text-left">
                <span className="flex items-center gap-1.5">
                  <span className="font-medium">{view.label}</span>
                  <span className="text-[9px] px-1 py-0.5 rounded bg-muted text-muted-foreground uppercase tracking-wide">
                    {view.tag}
                  </span>
                </span>
                <span className="block text-[10px] text-muted-foreground mt-0.5">{view.desc}</span>
              </span>
            </button>
          );
        })}
      </nav>

      <div className="p-3 border-t border-border text-[10px] text-muted-foreground shrink-0 space-y-1.5">
        <div className="flex items-center gap-1.5 font-semibold text-emerald-700">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Live backend · Postgres 18
        </div>
        <p>Guided (simple) vs Intelligence (advanced) — both solver-verified, live from the backend.</p>
      </div>
    </aside>
  );
}