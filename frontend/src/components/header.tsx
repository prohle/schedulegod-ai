"use client";

// Command header: brand + live institution scale. Polls the backend's
// current scenario so the strip always reflects the world being scheduled
// (story seed, department, university, or an ingested institution).
import { useEffect, useState } from "react";
import { GraduationCap, LogOut } from "lucide-react";
import type { Scenario } from "@/types";
import type { AuthUser } from "@/lib/auth";

export function Header({ user, onLogout }: { user?: AuthUser | null; onLogout?: () => void }) {
  const [sc, setSc] = useState<Scenario | null>(null);
  useEffect(() => {
    let live = true;
    const load = () =>
      fetch("/api/scenario")
        .then((r) => r.json())
        .then((d) => { if (live && d && Array.isArray(d.instructors)) setSc(d); })
        .catch(() => {});
    load();
    const t = setInterval(load, 8000);
    return () => { live = false; clearInterval(t); };
  }, []);

  return (
    <header className="bg-card/90 backdrop-blur border-b border-border px-4 py-2 flex items-center justify-between shrink-0 text-xs shadow-sm">
      <div className="flex items-center space-x-3">
        <div className="p-2 bg-gradient-to-tr from-sky-500 via-indigo-600 to-violet-600 rounded-lg text-white shadow-md shadow-indigo-500/25">
          <GraduationCap className="w-4 h-4" />
        </div>
        <div>
          <h1 className="font-extrabold text-sm text-foreground tracking-tight flex items-center gap-2">
            ScheduleGod AI
            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-sky-100 text-sky-700 border border-sky-200">
              solver-proven
            </span>
          </h1>
          <p className="text-[10px] text-muted-foreground">
            Agentic scheduling co-pilot · Muse Spark proposes, the solver proves
          </p>
        </div>
      </div>
      <div className="hidden md:flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 font-semibold">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Live backend
        </span>
        {sc && (
          <span className="px-2 py-1 rounded-full bg-muted border border-border font-medium text-foreground" title={sc.name}>
            {sc.instructors.length} instructors · {sc.sections.length} sections · {sc.cohorts.length} cohorts · {sc.programs?.length ?? 1} programs
          </span>
        )}
        <span className="text-[10px] text-muted-foreground hidden lg:block">
          Every answer is solver-proven — no guesswork
        </span>
        {user && (
          <span className="inline-flex items-center gap-2">
            <span className="px-2 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-800 font-semibold" title={user.email}>
              {user.display_name} · {user.role}
            </span>
            <button onClick={onLogout} title="Sign out"
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-muted border border-border font-semibold hover:bg-accent">
              <LogOut className="w-3 h-3" /> Sign out
            </button>
          </span>
        )}
      </div>
    </header>
  );
}
