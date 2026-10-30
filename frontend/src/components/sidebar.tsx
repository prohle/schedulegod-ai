"use client";

// Navigation: icon rail on desktop, tab bar on mobile.
// One-line labels stay visible; full descriptions hide in hover/tap tooltips.

import { Zap, Brain, CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tip } from "@/components/ui/tip";

export type ActiveView = "wizard" | "intelligence" | "schedule";

const VIEWS = [
  {
    id: "wizard" as const,
    label: "Wizard",
    icon: Zap,
    desc: "Step-by-step: Import → Intake → Build → Review → Emergency",
  },
  {
    id: "schedule" as const,
    label: "Schedule",
    icon: CalendarDays,
    desc: "Your published timetable (per role) + change requests",
  },
  {
    id: "intelligence" as const,
    label: "Insights",
    icon: Brain,
    desc: "Spectral radar · 4-course audit · solver · verified tightening",
  },
];

interface NavProps {
  activeView: ActiveView;
  setActiveView: (view: ActiveView) => void;
}

/** Desktop / tablet: slim rail. Hidden below lg — MobileNav takes over. */
export function Sidebar({ activeView, setActiveView }: NavProps) {
  return (
    <aside className="sticky top-0 hidden h-full w-[84px] shrink-0 flex-col border-r border-border bg-card lg:flex">
      <nav
        className="flex flex-1 flex-col items-stretch gap-1 p-2"
        aria-label="Main navigation"
      >
        {VIEWS.map((view) => {
          const Icon = view.icon;
          const isActive = activeView === view.id;
          return (
            <Tip key={view.id} label={view.desc} side="right" className="w-full">
              <button
                onClick={() => setActiveView(view.id)}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "relative flex min-h-14 w-full flex-col items-center justify-center gap-1 rounded-2xl px-1 py-2 transition-all duration-150 active:scale-[0.97]",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-md shadow-primary/25"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              >
                <Icon className="h-5 w-5 shrink-0" />
                <span className="text-[10px] leading-none font-semibold">{view.label}</span>
              </button>
            </Tip>
          );
        })}
      </nav>
      <div className="shrink-0 p-2">
        <Tip label="Live backend · Postgres 18 · every answer solver-verified" side="right" className="w-full">
          <div className="flex min-h-11 w-full items-center justify-center gap-1.5 rounded-2xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/70">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
            <span className="text-[10px] font-bold">Live</span>
          </div>
        </Tip>
      </div>
    </aside>
  );
}

/** Mobile: fixed bottom tab bar with safe-area padding. Hidden on lg+. */
export function MobileNav({ activeView, setActiveView }: NavProps) {
  return (
    <nav
      className="glass pb-safe fixed inset-x-0 bottom-0 z-50 border-t border-border shadow-[0_-8px_30px_rgba(15,23,42,0.06)] lg:hidden"
      aria-label="Main navigation"
    >
      <div className="mx-auto grid max-w-md grid-cols-3 px-2 pt-1.5 pb-1.5">
        {VIEWS.map((view) => {
          const Icon = view.icon;
          const isActive = activeView === view.id;
          return (
            <button
              key={view.id}
              onClick={() => setActiveView(view.id)}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-2xl px-2 py-1.5 transition-all duration-150 active:scale-[0.96]",
                isActive
                  ? "bg-primary text-primary-foreground shadow-md shadow-primary/25"
                  : "text-muted-foreground active:bg-accent"
              )}
            >
              <Icon className="h-5 w-5" />
              <span className="text-[10px] leading-none font-semibold">{view.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
